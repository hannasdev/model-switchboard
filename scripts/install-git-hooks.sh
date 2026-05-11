#!/bin/sh

set -eu

git config core.hooksPath .githooks
chmod +x .githooks/pre-commit .githooks/commit-msg

echo "Installed local git hooks at .githooks"
echo "Current core.hooksPath: $(git config --get core.hooksPath)"
