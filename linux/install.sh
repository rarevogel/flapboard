#!/bin/sh
# Installs the Flapboard screensaver for the current user (no root needed).
#   ./install.sh            install, start at every login, and start it now
#   ./install.sh --remove   remove it again
set -e
here=$(cd "$(dirname "$0")" && pwd)
data="${XDG_DATA_HOME:-$HOME/.local/share}/flapboard"
apps="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
auto="${XDG_CONFIG_HOME:-$HOME/.config}/autostart"
bin="$HOME/.local/bin"
if [ "$1" = "--remove" ]; then
  pkill -f "$data/flapboard-saver" 2>/dev/null || true
  rm -rf "$data" "$auto/flapboard-saver.desktop" "$apps/flapboard-saver-settings.desktop" "$bin/flapboard-saver"
  echo "Flapboard screensaver removed."; exit 0
fi
mkdir -p "$data" "$apps" "$auto" "$bin"
cp "$here/flapboard.html" "$data/flapboard.html"
cp "$here/flapboard-saver" "$data/flapboard-saver"; chmod +x "$data/flapboard-saver"
ln -sf "$data/flapboard-saver" "$bin/flapboard-saver"
cp "$here/flapboard.svg" "$data/flapboard.svg" 2>/dev/null || true
cat > "$auto/flapboard-saver.desktop" <<EOD
[Desktop Entry]
Type=Application
Name=Flapboard screensaver
Comment=Shows the split-flap board when the computer is idle
Exec=$data/flapboard-saver
Icon=$data/flapboard.svg
X-GNOME-Autostart-enabled=true
NoDisplay=false
EOD
cat > "$apps/flapboard-saver-settings.desktop" <<EOD
[Desktop Entry]
Type=Application
Name=Flapboard screensaver settings
Comment=Choose trains or flights, country, writing and look for the screensaver
Exec=$data/flapboard-saver --settings
Icon=$data/flapboard.svg
Categories=Settings;DesktopSettings;
EOD
command -v chromium >/dev/null || command -v chromium-browser >/dev/null || command -v google-chrome >/dev/null || command -v firefox >/dev/null || \
  echo "Note: no browser found. Install one, e.g.: sudo apt install chromium"
pkill -f "$data/flapboard-saver" 2>/dev/null || true
nohup "$data/flapboard-saver" >/dev/null 2>&1 &
echo "Installed. The board appears after 5 minutes without mouse or keyboard."
echo "  Try it now:        flapboard-saver --now"
echo "  Settings:          flapboard-saver --settings   (or 'Flapboard screensaver settings' in the menu)"
echo "  Other idle time:   flapboard-saver --minutes 10"
