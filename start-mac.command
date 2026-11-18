#!/bin/bash
# Double-click in Finder to set up (first time) and open CineCircle.
cd "$(dirname "$0")" || exit 1
# Finder does not load the shell profile, so add the usual Node.js install locations.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js is not installed. Install the LTS version from https://nodejs.org, then open this file again."
  read -r -p "Press Enter to close. " _
  exit 1
fi
npm start
status=$?
if [ $status -ne 0 ]; then read -r -p "CineCircle stopped. Press Enter to close. " _; fi
exit $status
