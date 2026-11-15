# ale-tinker-lab

A personal sandbox for trying out libraries, workflows and app ideas in one app.

## Language

**Experiment**:
One self-contained idea being tried out, living as its own route in the app.
_Avoid_: Project, app (there is only one app)

**Production**:
The live version of the app, built from merged work, holding real data.
_Avoid_: Prod, live site

**Preview**:
A temporary deployment of unmerged work, used to try a change before it reaches Production. It only ever sees fake data.
_Avoid_: Staging (there is no staging environment)

## Staff Reading Game

**Staff**:
The five horizontal lines notes are placed on.
_Avoid_: Pentagram

**Clef**:
The symbol that fixes which pitch each line and space stands for. The game offers treble (bottom line E4, top line F5) and bass (bottom line G2, top line A3).

**Step**:
One move from a line to the adjacent space, or from a space to the adjacent line. The unit of vertical position, counted from the clef's bottom line.

**Ledger line**:
A short line drawn through or beside a note that sits above or below the staff.

**Visible area**:
The staff plus two ledger lines above and below it: A3 to C6 in treble, C2 to E4 in bass. Notes can be placed anywhere in it, whatever the Range preset.

**Canonical note**:
A note written as letter plus octave in scientific pitch notation, such as G4. Always how a note is stored, whatever the Note naming.

**Note naming**:
How note names are shown to the player: letters (C D E F G A B) or solfège (Do Re Mi Fa Sol La Si). It never changes what is stored.

**Range preset**:
A named set of notes a Prompt can draw from: Landmarks, Lines, Spaces, Full staff or Extended.

**Prompt**:
One note the player must answer, either a note shown on the staff to name or a note name to place.

**Commit**:
The moment an answer becomes final: a click, a Confirm tap, an Enter key or an answer button press.

**Session**:
One continuous play period, either a Practice or a Round.

**Practice**:
An endless, unscored Session that ends when the player exits.

**Round**:
A scored Session of 20 new Prompts plus any re-queued misses. Only a completed Round can be a Personal best.

**Attempt**:
One answered Prompt, with its result and response time.

**Streak**:
The number of consecutive correct Attempts in the current Session. It sets the score multiplier in a Round.

**Re-queue**:
Bringing a missed note back as an extra Prompt a few Prompts later. A Round re-queues a note at most twice; Practice has no limit.

**Personal best**:
The highest score among completed Rounds with the same mode, clef and Range preset.

**Progress storage**:
Where Sessions, Attempts and settings are kept between visits. In v1 it is the browser, in a shape ready to sync to a database later.
