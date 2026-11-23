# Hinton Water Disinfection Report: the app

An installable web app for disinfecting and sampling new PWD water mains, built from the original claude.ai prototype.
It's for one person. Everything is saved on that person's device and it works with no signal.

Live: https://mike-ciampoli.github.io/hinton-report/

## What's in this folder
| File | What it is |
|---|---|
| `index.html` | The page itself |
| `js/app.js` | The screens, the PWD rules (checklist, lab ranges, email fields), printing, backup |
| `js/store.js` | Saves data on the device (IndexedDB) |
| `js/version.js` + `sw.js` | Version number and offline support |
| `css/app.css` | The look, including the print layout |
| `manifest.webmanifest` | Name and icon used when installed to the home screen |
| `fonts/` | Barlow fonts (SIL Open Font License, `fonts/OFL-LICENSE.txt`) |
| `icons/` | App icons (`tools/make-icons.ps1` redraws them) |
| `tools/serve.ps1` | Tiny local web server for testing |

The PWD staff email list is **not** in this code, because the code is public. It's pasted into the app once (Streets screen > Email recipients) and stays on the device.

## Making a change
1. Edit the files.
2. Bump the version in **both** `js/version.js` and the `VERSION` line in `sw.js`.
3. Commit and push. GitHub Pages updates in a minute or two. Installed copies show "A new version is ready".

## Data
- Stored in the browser's IndexedDB on the device (key `state3`), nowhere else.
- **Back up** saves one `.json` file. **Restore** loads it back, and the restore can be undone.
- Streets saved by version 1.x are copied in on first launch (the old data is left in place). Backups from 1.x can also be restored.

## Printing
Print/Save builds the chosen streets and/or the full Analysis, then opens the device's print screen.
"Save as PDF" puts the file in Downloads/Documents on the device. A gray footer repeats on every page.

## Testing locally
From this folder run `powershell -ExecutionPolicy Bypass -File tools\serve.ps1` and open http://localhost:8765
