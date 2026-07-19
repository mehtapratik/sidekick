#!/bin/bash
set -e

node_modules/.bin/astro build
node_modules/.bin/pagefind --site dist
