Flapboard screensaver for Windows 10 / 11
=========================================

Install
  Right-click Flapboard.scr and choose "Install". The screen saver settings open with Flapboard selected:
  set the wait time there and click OK.
  (Or copy Flapboard.scr to C:\Windows\System32 and choose it under Settings > Personalisation > Lock screen > Screen saver.)

Settings (trains or flights, country, writing, look, sound)
  In the screen saver settings click "Settings...": the board opens in a window with its settings.
  Choose, then close the window. The screensaver shows the board as you left it.
  Close that window before the screensaver starts, or it cannot open the full-screen board.

How it works
  The board is shown full screen by Microsoft Edge (already on every Windows 10/11 PC; Google Chrome is used if Edge is missing)
  in kiosk mode, served by the screensaver itself on 127.0.0.1, with its own profile in %LOCALAPPDATA%\Flapboard, so your normal browser, tabs and history are not touched.
  Other monitors go black. Moving the mouse or pressing a key closes it.
  The little preview picture in the screen saver dialog stays empty; click "Preview" to see the real thing.
  The flap sound plays during the screensaver if "Flap sound" is on in the settings.

Live NS (Dutch railways)
  In the settings choose "NS live (Netherlands)" under Board, pick a station and paste your free NS key
  (account at apiportal.ns.nl, product "Ns-App", primary key). The screensaver serves the board itself on
  http://127.0.0.1:47815 and passes the requests on to NS; Windows may ask once whether it may use the network.

Windows may warn that the file comes from an unknown publisher (it is not code-signed):
  choose "More info" > "Run anyway", or right-click > Properties > Unblock.

Remove: pick another screen saver, delete Flapboard.scr and the folder %LOCALAPPDATA%\Flapboard.
