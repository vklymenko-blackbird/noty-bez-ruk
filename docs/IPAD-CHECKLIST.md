# iPad checklist: "Ноти без рук"

Use this list on a real iPad mini. You do not need to be a developer.
For each step, do the action. Compare with "Expected". Tick the box when it matches.
If it does not match, write what you saw next to the step.

Replace `<app URL>` with the address of the app.

## 0. Your iPad
- [ ] Open Параметри › Загальні › Про пристрій.
- Write down the model: ______________________
- Write down the iPadOS version: ______________________
- Expected: iPadOS 16.4 or newer.

## 1. Install to the Home Screen FIRST
Scores you add in Safari do not move to the installed app. So install before you add anything.
- [ ] Open `<app URL>` in Safari.
- [ ] Tap Share, then "На початковий екран", then "Додати".
- [ ] Close Safari. Open the app from the new icon.
- Expected: the app opens full screen, with no Safari address bar.

## 2. Direction check (10 seconds)
- [ ] In the installed app or in Safari, open `<app URL>?test=1&camera=1#/dev/gesture`.
- [ ] Allow the camera.
- [ ] Turn your head to your own right.
- Expected: the "yaw" number goes up (positive).
- [ ] Pull your mouth to your own right.
- Expected: the "mouthR" number goes up.
- Write down: yaw at a comfortable turn ______ ; mouthR at a clear pull ______ ; mouthL at a clear pull ______
- If a direction is reversed: use "Поміняти напрямок" (in the play menu or in Налаштування). Then check again.

## 3. First launch and onboarding
- [ ] Delete the app and install it again (or use a new browser profile).
- [ ] Open the app.
- Expected: the install step shows first. Then three cards. Then the empty library.
- [ ] Tap "Налаштування", find "Показати вступ ще раз".
- Expected: the introduction opens again.

## 4. Find and add scores
- [ ] Tap "Знайти ноти". Type "До Елізи".
- Expected: a card with a licence badge shows.
- [ ] Tap "Додати". Wait. Tap "Відкрити".
- Expected: the score screen opens with page thumbnails.
- [ ] Open the first 12 pieces of "Популярне", one by one.
- Expected: each PDF is the piece named on the card. Write down any wrong piece: ______________________
- [ ] Try "Відкрити PDF" with a file from the Files app.
- Expected: the file is added to the library.

## 5. Play with head turns
- [ ] Open a score. Tap "Грати". Do the calibration (look at the page, keep still).
- [ ] Turn your head to the side that you checked in step 2 (next page).
- Expected: the page turns after you hold the turn for a short time. The page does not turn when you look back.
- [ ] Turn to the other side.
- Expected: the previous page shows.
- [ ] Repeat in dim light.
- [ ] Repeat with glasses.
- [ ] Look down at your hands for a few seconds.
- Expected: the page does NOT turn.
- Notes: ______________________

## 6. Mouth gesture
- [ ] In Налаштування, choose the mouth gesture.
- [ ] In play mode, pull your mouth to the right side for a moment.
- Expected: next page. A pull to the left goes back.
- [ ] Talk and smile normally for 30 seconds.
- Expected: no false turns. Write down how many: ______

## 7. Half-page turn and the divider
- [ ] Turn on "Півсторінки" in play mode.
- [ ] Make one head turn.
- Expected: the next page shows in the lower half, with a divider line. Another turn shows the full next page.

## 8. Tap, swipe and Bluetooth pedal
- [ ] Tap the right edge of the page. Expected: next page.
- [ ] Tap the left edge. Expected: previous page.
- [ ] Swipe left on the page. Expected: next page.
- [ ] Tap the centre. Expected: the play menu opens.
- [ ] Connect a Bluetooth pedal. In Налаштування, use "Навчити клавішу" for next and for previous. Press the pedal.
- Expected: the pages turn. Note: while the pedal is connected, the on-screen keyboard is hidden.
- Write down the keys your pedal sends: ______________________

## 9. The screen stays on
- [ ] In the installed app, start play mode. Do not touch the screen for 10 minutes.
- Expected: the screen stays on.
- If it dims or locks: follow the Auto-Lock hint in the app, and write it down here: ______________________

## 10. Camera permission denied
- [ ] Open Параметри, find the app, turn the Camera off (or choose "Не дозволяти" at the prompt).
- [ ] Open play mode.
- Expected: a banner explains the problem and shows "Спробувати ще раз".
- [ ] Turn pages by touch.
- Expected: touch turning works.
- [ ] Allow the camera. Tap "Спробувати ще раз".
- Expected: head turning works again.
- Write down the real Ukrainian name of the Camera setting on this iPad: ______________________
- Write down the real Ukrainian name of the Auto-Lock setting on this iPad: ______________________
- Write down: does the camera prompt show on each launch of the app? ______

## 11. Apple Pencil notes and palm rejection
- [ ] In play mode, open the menu and tap "Нотатки".
- [ ] Draw with the Pencil. Rest your palm on the screen while you draw.
- Expected: the Pencil draws. The palm does not draw (finger drawing is off by default).
- [ ] Add a stamp. Erase a mark. Tap "Готово". Close the app and open it again.
- Expected: the notes are still there.

## 12. Paper themes and crop on a big scanned score
- [ ] Add a real scanned score of 20 pages or more from the catalogue.
- [ ] Open it. Measure with a clock.
- Expected: the first page shows in under 3 seconds. Write down: ______
- [ ] Turn 40 pages with the camera on.
- Expected: each turn takes under 1 second. The app does not reload.
- [ ] Try the paper themes and "Обрізати поля".
- Expected: the notes get bigger. The original file does not change.

## 13. Airplane mode
- [ ] Open a stored score once, then turn on airplane mode.
- [ ] Close the app, open it again, open the score, play.
- Expected: it works with no internet. Search shows "Пошук потребує інтернету" for Commons.

## 14. Battery
- [ ] Note the battery level: ______ %
- [ ] Play with the camera on for 30 minutes.
- [ ] Note the battery level: ______ %
- Expected: a plausible drop. For long sessions, use the charger.

## 15. Update
- [ ] After a new version is deployed, keep the app installed and open it each day.
- Expected: within a day, the toast "Оновлення готове" appears. It never appears during play.

## What automated tests cannot prove
These items need the real iPad. Each has a soft failure path in the app.

| # | Unverified | What the app does if it is wrong | Step |
|---|---|---|---|
| 1 | The iPad model and iPadOS version; the minimum that works (expected 16.4) | boot message on a very old system | 0 |
| 2 | The yaw sign (own right = next) | «Поміняти напрямок»; live readout at the dev gesture page | 2 |
| 3 | The side and size of the mouth values | the same switch; the readout shows the numbers | 2, 6 |
| 4 | The thresholds in real playing, dim light, glasses, dropped frames | sensitivity settings | 5 |
| 5 | The pitch gate (15°): it must stop false turns when you look at your hands, and never block a wanted turn | recalibrate in the play menu | 5 |
| 6 | Wake Lock in the Home Screen app (expected from iPadOS 18.4) | Auto-Lock hint | 9 |
| 7 | MediaPipe under the CSP on Safari; GPU delegate; other MediaPipe log lines | banner with retry; touch turning | 5, 10 |
| 8 | Camera permission prompts on each launch; real names of the Camera and Auto-Lock settings | banner with retry and how-to text | 10 |
| 9 | Home Screen storage is separate from Safari; Safari eviction after days | install step first, library banner | 1 |
| 10 | Commons search and downloads from Safari on the iPad | error toast, «Відкрити джерело», import from Files | 4 |
| 11 | Real 600 dpi IMSLP scans: speed, memory, page reloads with the camera on | 8 MP canvas cap | 12 |
| 12 | The pdf.js legacy build on an older iPadOS | error toast | 4, 12 |
| 13 | Pencil pressure and palm rejection | finger drawing off by default | 11 |
| 14 | A Bluetooth pedal's keys; the hidden on-screen keyboard | «Навчити клавішу» | 8 |
| 15 | Service worker updates in a long-resumed Home Screen app | update check on resume | 15 |
| 16 | Battery use with the camera on | hint on onboarding card 3 | 14 |

Also not proven by tests: the catalogue quality. Each resolved Commons file is chosen by rules, not by a person. Step 4 checks the first 12 pieces by eye.
