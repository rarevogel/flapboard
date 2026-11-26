Flapboard screensaver for Linux (Linux Mint Cinnamon, MATE, Xfce and other X11 desktops)
========================================================================================

Install (no root needed):
  ./install.sh
It starts at every login, and the board appears after 5 minutes without mouse or keyboard.
Moving the mouse or pressing a key closes it.

  flapboard-saver --now           try it now
  flapboard-saver --settings      choose trains/flights, country, writing, look, sound (also in the menu:
                                  "Flapboard screensaver settings"); close the window when done
  flapboard-saver --minutes 10    another wait time
  ./install.sh --remove           remove it again

It needs a Chromium-type browser (Chromium, Chrome, Brave, Edge, Vivaldi) or Firefox; Chromium works best:
  sudo apt install chromium
The board runs in that browser in kiosk mode with its own profile (~/.local/share/flapboard), so your normal browser is untouched.

Your desktop's own screensaver and screen blanking still run on their own timers. Set them longer than
Flapboard's wait time (Cinnamon: System Settings > Screensaver, and Power Management), otherwise the
screen locks or goes dark before the board appears. While a video player asks the desktop not to start
a screensaver, Flapboard waits too.
Live NS (Dutch railways): choose "NS live" under Board in the settings and paste your free NS key.
The screensaver relays the requests through a small local server on 127.0.0.1:47815.
Needs an X11 session (the default on Linux Mint); on Wayland install xprintidle.
