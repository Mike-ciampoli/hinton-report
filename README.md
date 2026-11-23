# Hinton Water Disinfection Report: the app

An installable web app for disinfecting and sampling new PWD water mains.
It's for one person. Everything is saved on that person's device and it works with no signal.

## What's in this folder
| File | What it is |
|---|---|
| `index.html` | The page itself |
| `js/rules.js` | **PWD rules**: checklists for each method and fix, chlorine limits, timers, lab ranges, email fields, footer text. Change the rules here. |
| `js/forms.js` | Printable PWD forms: Initial Sample Request, Resample Request, Continuous Feed Disinfection Form (Pre / Post), Chlorine Verification Log |
| `js/app.js` | The screens and how they behave |
| `js/store.js` | Saves data on the device |
| `js/version.js` + `sw.js` | Version number and offline support |
| `css/app.css` | The look, including the print layouts |
| `manifest.webmanifest` | Name and icon used when installed to the home screen |
| `fonts/` | Barlow fonts from the @fontsource/barlow packages (SIL Open Font License, `fonts/OFL-LICENSE.txt`) |
| `icons/` | App icons. `tools/make-icons.ps1` redraws them with Microsoft Edge (or `tools/make-icons.js` with Node + Playwright). |
| `tools/serve.ps1` | Tiny local web server for testing, no install needed |

The PWD staff email list is **not** in this code, because the code is public. It's pasted into the app once (Backup > Email recipients) and stays on the device.

If the fonts or icons are ever missing, the app still works, offline too. It uses the phone's own fonts.

## Making a change
1. Edit the files.
2. Bump the version in **both** `js/version.js` and the `VERSION` line in `sw.js`.
3. Publish (commit and push to GitHub; GitHub Pages updates in a minute or two). Installed copies show "A new version is ready" and update without touching data.

## Data
- Stored in the browser's IndexedDB on the device, nowhere else.
- **Back up** saves one `.json` file with everything. **Restore** loads it back, and the restore can be undone.
- A reminder appears on the home screen when it's been 7 days since the last backup.
- Data saved by version 1.0 is upgraded automatically: old notes become the first log entry, and old resample rounds become "Re-chlorination (Resample form)".

## Testing locally
From this folder run `powershell -ExecutionPolicy Bypass -File tools\serve.ps1` and open http://localhost:8765
