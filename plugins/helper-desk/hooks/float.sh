#!/bin/sh
# Helper Desk in a Zellij floating pane: redraws the frame file helper-desk writes; q quits.
# helper-desk replaces the file whole on each change. A first line of "#ended", or no file,
# ends the viewer, and zellij closes the pane (it was opened with --close-on-exit).
frame=$1
saved=$(stty -g 2>/dev/null)
restore() {
  printf '\033[?25h'
  [ -n "$saved" ] && stty "$saved" 2>/dev/null
}
trap restore EXIT
trap 'exit 0' INT TERM HUP
# Keys arrive one at a time and without waiting, so q works between redraws.
stty -icanon -echo min 0 time 0 2>/dev/null
printf '\033[?25l\033[2J'
old=
oldrows=
while [ -f "$frame" ]; do
  new=$(cat "$frame" 2>/dev/null) || break
  case $new in '#ended'*) break ;; esac
  rows=$(stty size 2>/dev/null | cut -d' ' -f1)
  if [ "$new" != "$old" ] || [ "$rows" != "$oldrows" ]; then
    # Home, the frame cut to the pane's height, then clear what is left below it.
    printf '\033[H%s\033[J' "$(printf '%s\n' "$new" | head -n "${rows:-40}")"
    old=$new
    oldrows=$rows
  fi
  key=$(dd bs=1 count=1 2>/dev/null)
  [ "$key" = q ] && break
  sleep 0.3
done
