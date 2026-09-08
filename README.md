# Tapko's Defense

Prompt for Lovable — "Protect Tapko" game prototype

Copy everything below into Lovable chat as a single message.

Build a web game (React + plain CSS only — NO canvas/WebGL/PixiJS or any game engine library, this is intentional, I need a simple DOM/CSS version to quickly test the game mechanic) for mobile browsers.

Concept

The game is called "Protect Tapko" — a short casual mini-game for a marketing project (an NFC figurine placed in local businesses that visitors tap with their phone). The character is a cute dog-dragon hybrid creature named Tapko. Wolves attack him, and the player defends him by tapping the wolves before they get close.

Architecture requirement (important, follow strictly)

Split the project into two independent layers that must not know about each other:

gameEngine — a pure game-state module (no DOM/JSX inside it at all): a state object { mascotHP, wolves: [{id, x, y, speed, state}], level, status, timeLeft }, and a tick(state, deltaTime) function that returns a new state (wolf movement, collision checks against the character, HP loss). Plus hitWolf(state, wolfId) and startGame(level) functions.

UI components — simply read the state from gameEngine and render divs at the corresponding coordinates. No game logic inside components.

This split is intentional: the render layer will later be swapped for a different engine, and the game logic must stay unchanged.

Gameplay

The character (Tapko) stands in the center of the screen.

Wolves spawn from the edges of the screen and move toward the character.

Tapping/clicking a wolf removes it (with a brief "knockback" before it disappears).

If a wolf reaches the character, the character loses 1 HP out of 3.

If HP reaches 0 — game over (lose).

If the player survives until the level timer runs out — win.

Two difficulty levels:

Easy: ~15-20 seconds, fewer and slower wolves.

Hard: ~30-40 seconds, more and faster wolves.

Keep rounds short — this is "fast-food" content like TikTok/Reels, not a long game.

Character states (build these as separate visual components/CSS classes so real sprites can be swapped in later)

idle — resting state (subtle sway animation via CSS keyframes).

fear — triggered when a wolf gets very close.

hit — triggered right after the character loses HP (brief flash/shake).

victory — win state.

defeat — lose state.

Each state shows a random short line in a speech bubble (sentence case, no trailing period, casual tone):

fear: "Uh-oh!", "Watch out!"

hit: "Ouch!", "That hurt..."

victory: "We did it!", "You're my hero!"

defeat: "Oh no..."

Placeholder style (temporary, until real assets are wired in)

Use simple CSS shapes (divs with border-radius). Color palette:

Background (dusky forest twilight): #2B2438

Character body: #E8C99B

Warm accent glow behind the character: #F2A65A (semi-transparent)

Wolves (silhouette): #4A4550, wolf eyes: #D4534C

Speech bubble: background #F2A65A, text #5A3410

Structure the CSS so each element (character, wolf) is a single container with a solid fill — so it can later be swapped for a background-image with a real sprite in one line, without reworking the layout.

HUD (overlay UI)

Top left: current level badge ("Level 1 · Easy").

Top right: 3 heart icons that disappear one at a time when the character takes a hit.

Bottom: a short hint "Tap the wolves to fight them off" (shown only at the start of a round).

Analytics (stub, just console-logs for now)

Create a logEvent(eventName, payload) function that just does console.log for now, but call it at these points so the structure is ready to wire up to a real backend later:

game_started (on pressing "Start")

wolf_hit

mascot_damaged

game_won

game_lost

reward_shown

review_link_clicked

Reward screen (after winning)

Show a reward (e.g. a promo code/bonus) — granted regardless of whether the player does anything afterward.

A separate, fully optional button below it — "Leave a review" (a placeholder link for now). This button must NOT look like a condition for getting the reward — the two must be visually separated.

Technical requirements

Mobile-first design, full screen with no scrolling during gameplay.

Support both touch (mobile) and click (desktop).

Fast load, minimal dependencies.

Cross-browser: make sure animations and tap events work correctly on iOS Safari (avoid Chrome-only CSS properties).

All interface text in English, casual and warm tone.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/443bc35b-980e-454c-9394-40d801c88f10).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
