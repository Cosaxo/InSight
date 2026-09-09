# The front door — Claude Design, 2026-09-07

The owner's canvas for [`VISUAL-REQUESTS.md`](../../docs/VISUAL-REQUESTS.md)
request 9, the sign-in screen the account wall needs
([`SIGNIN-PLAN.md`](../../docs/SIGNIN-PLAN.md)). Delivered as one
bundled page: twelve live artboards, not pictures of them, so the doors
actually work in the canvas — tapping Apple or Google runs the round
trip, and *Use email instead* opens the form.

`Front_Door_Artboards.html` is the file as delivered. It is a bundle:
the screen's markup and behaviour are a gzipped asset inside it rather
than markup you can read in a diff, so **this README is the readable
half** and the reason it exists.

## The twelve artboards

| | Light | |
| --- | --- | --- |
| 1a | Default | two doors, email folded |
| 1b | Email open | signing in |
| 1c | Creating an account | same screen, toggled |
| 1d | Mid-flight | Apple tapped, the app is away |
| 1e | Error | wrong password |
| 1f | Error | no account with that address |
| 1g | Error | address already taken, while creating |
| 1h | Error | network down |
| 1i | Reset email sent | the only way on is the inbox |
| 1j | **Dark** | default |
| 1k | **Dark** | email open, creating |
| 1l | Small phone 375×667 | password above the keyboard |

iPhone 402 × 874 unless the row says otherwise.

## Every string it settled

Copy, verbatim, because this is what the build has to match and D182
governs it:

- **Lockup line** — *One question a day. See what everyone's answers
  say about each other.*
- **Apple** — *Sign in with Apple* / *Sign up with Apple*. It follows
  the mode; Google's does not.
- **Google** — *Continue with Google*, always.
- **Divider** — *or*
- **Email** — *Use email instead*, and *Cancel* to fold it back.
- **Primary** — *Sign in* / *Create account*, and *Try again* when the
  error is offline.
- **Toggle** — *New here? Create an account* / *Have an account? Sign in*
- **Errors, each naming its own way out** — this is the part the request
  did not ask for and should be kept:
  - *No account uses this address yet.* → **Create one**
  - *This address already has an account.* → **Sign in instead**
  - *That password doesn't match this address.* → **Forgot password?**
  - *You're offline. Check your connection, then try again.*
- **Reset sent** — *Check your inbox* · *We sent a reset link to
  {address}. It works for an hour.* · **Open Mail** · **Back to sign in**
- **The honest line** — *Answers on InSight are public, yours included.*
- **Legal** — *By continuing you agree to the Terms and the Privacy
  Policy.*

## Three behaviours worth naming, because a static reading loses them

1. **The toggle hides while the keyboard is up and while a door is
   in flight** (`showToggle: !keyboard && !inFlight`). A row that
   offers a mode switch under a spinner is a row that gets tapped by
   accident.
2. **The legal footer hides when the keyboard is up** (`showFooter:
   isDoor && !keyboard`) — artboard 1l is that case drawn, and the
   reason the small phone got an artboard of its own.
3. **Every door dims and disables the others while one is in flight.**
   Only the tapped door spins.

## What it keeps from the screen it replaces

The shell of `ui/LiveSignInGate.tsx`: full screen on the second surface
colour, content centred at 420, safe-area padding top and bottom, and
D302's stacked lockup at 44px. The request asked for that to survive and
it did.

## Status

`designed`. The build is request 9's row in `VISUAL-REQUESTS.md` and
step 3 of `SIGNIN-PLAN.md`.
