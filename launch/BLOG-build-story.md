# Free forever is an architecture, not a pricing decision

I built a recipe keeper called [Recipe Jar](https://recipejar.app). You paste a
recipe link, it gives you a clean card with just the ingredients and steps, and
you can save as many recipes as you want. No account, no ads, works offline,
free forever.

That last part, "free forever," is usually where you should get suspicious. I
get suspicious too. Every "free" recipe tool I tried eventually capped saved
recipes at 20 or 40 and asked for money past that, which is fair, they have a
database to pay for. So when I say free forever, the honest question is: what is
the catch, and what happens when the bills come due?

The answer is that there are no bills, because there is almost nothing to run.
That is not a promise about my intentions. It is a property of how the thing is
built. This post is about that.

## The whole app is your browser

Recipe Jar has no application server and no database. Your recipes live in your
own browser's IndexedDB, on your device. When you save a recipe, nothing is
uploaded, because there is nowhere to upload it to. The site itself is a pile of
static files on a CDN.

That single decision cascades into everything the product claims:

- **No account**, because there is no server-side user to attach data to.
- **Works offline**, because it is a PWA and your recipes are already local.
- **Private**, because your data never leaves the device unless you export a
  backup yourself.
- **Free forever**, because static hosting plus on-device storage costs the same
  at ten users and ten million: roughly nothing.

The cost curve is the feature. A freemium recipe app caps your saves because
each saved recipe is a row in a database they pay for. Mine cannot cap you,
because your saves are not my problem to store. The economics and the privacy
are the same fact viewed from two angles.

## The one piece of server that exists

There is exactly one bit of backend: a stateless fetch proxy, a single
Cloudflare Pages Function. When you paste a URL, your browser cannot fetch that
page directly because of CORS, so the proxy fetches it and hands the HTML back.
It is about a hundred lines. It stores nothing, it has no database, and it keeps
no record of who asked for what. It just reads a public page and forwards it,
the same thing your browser's reader mode does.

I hardened it because an open proxy is an abuse magnet: it checks the request
actually came from the app, refuses internal and loopback addresses so it cannot
be turned into an SSRF tool, restricts responses to HTML, and edge-caches so two
people fetching the same recipe share one upstream request.

## The bot walls, and being honest about them

Some sites (NYT Cooking, AllRecipes, a few big publishers) return a 403 to my
proxy no matter what headers it sends. A commenter on launch day pushed on this:
if you set the right user agent, how does the site even know it is a bot?

The answer is that user agent and headers are the easy, spoofable part.
Modern bot protection reads the TLS handshake itself. A real Chrome negotiates
TLS with a specific ordering of ciphers and extensions; curl, or my Cloudflare
function, negotiate it differently. That fingerprint (people call it JA3) gives
you away no matter what the headers claim. Add IP reputation, my fetch comes
from a datacenter range and you browse from a home ISP, and a site can refuse
every non-browser with high confidence.

Could I spoof the fingerprint? There are libraries for it. But it is an arms
race I would lose, since I do not control the TLS stack Cloudflare gives me, and
honestly it is a race I do not want to run. The whole posture of the app is
reader mode: fetch what you could already read, keep it privately on your own
device, never republish it. Defeating bot walls is a different, more hostile
business.

So for those sites there is a bookmarklet. It runs inside your actual browser,
on the page you are already looking at, so the request carries your real
fingerprint and your real IP, because it is you. No spoofing, no arms race. The
limitation became a design line, not a bug to paper over.

## Three things that bit me

**Svelte 5 state proxies do not survive IndexedDB.** Svelte 5 wraps anything you
put in `$state` in a deep reactive Proxy. IndexedDB's structured clone throws
`DataCloneError` on a Proxy. I claimed the jar "worked" before I had actually
tested a save in a browser, and it did not. The fix is a JSON round-trip at the
database boundary to read a plain object back out of the proxy. The lesson,
relearned: always browser-test an IndexedDB write, never trust that it compiles.

**A regex lookbehind white-screened the whole app on older iOS Safari.** I had a
lookbehind in the parser. Safari before 16.4 does not support it, and it is a
syntax error, so the entire bundle failed to parse and users on slightly older
iPhones got a blank page. Playwright's WebKit was too new to catch it. I found
it by reading the code with old-Safari support tables open, then rewrote the
regex without the lookbehind. Cross-engine testing is necessary but not
sufficient; the engine version matters.

**The bundle size is a budget, not an accident.** The app is about 70KB gzipped,
enforced in CI. Every feature has to fit, which is why the parser is plain
string and regex work with no DOM dependency, and why there is no state library.
On real-world field data the largest-contentful-paint is well under Google's
"good" threshold, which matters most on the cheap Android phones I eventually
want this to reach.

## Cook mode came from actually cooking

The feature people mention most is cook mode: it shows one step at a time in
large text, keeps the screen awake, and turns any duration in the instructions
("simmer 20 minutes") into a tappable timer. It exists because I kept burning
garlic while scrolling back up to check how long something needed, with the
screen dimming under my floury hands. A stranger on launch day described hitting
"next" with floury hands and it made my week, because that is the exact moment I
built it for.

## The tradeoff, stated plainly

Local-first is not free of downsides, and pretending otherwise would undercut
the honesty the whole thing runs on. Your recipes live only on your device, so
if you clear your browser or lose the phone, they are gone. There is no cloud
safety net because there is no cloud. The app nudges you to export a one-file
backup, and you can point that backup at any synced folder you like, but the
responsibility is yours. That is the real cost of owning your data instead of
renting it back from someone.

For a recipe keeper, I think that is the right trade. It is not a bank. It is a
jar on your own shelf.

## If you want to look

Recipe Jar is live at [recipejar.app](https://recipejar.app) and open source
(MIT) at [github.com/sbmagar13/recipe-jar](https://github.com/sbmagar13/recipe-jar).
The architecture doc walks through all of the above in one page, and if you find
a recipe site that does not import cleanly, that is the most useful bug report
you can file.

It is on Product Hunt today if you want to poke at it:
[producthunt.com/products/recipe-jar](https://www.producthunt.com/products/recipe-jar).
