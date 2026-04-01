#!/bin/sh
npm run check && npm run build && link-checker && check-version && check-tags
