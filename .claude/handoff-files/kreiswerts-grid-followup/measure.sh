#!/bin/bash
# measure.sh <name> <path> [extra js run on the target page] [user] – layout audit of one page of the own instance (port 3190)
set -o pipefail
R=<repo>; S=<scratchpad>
export DEV_WS=$HOME/mk_dev/dev_ws PATH=$S/bin:$PATH
NAME=$1; URLPATH=$2; EXTRA=${3:-}; USERNAME=${4:-site_a}
PW=$(grep '^DEMO_PASSWORD=' $R/.env.demo | cut -d= -f2-)
[ "$USERNAME" = admin_demo ] && PW=$(grep '^DEMO_ADMIN_PASSWORD=' $R/.env.demo | cut -d= -f2-)
JS="(async () => { if (location.pathname === '/login') { await fetch('/api/auth/sign-in/username', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: '$USERNAME', password: '$PW' }) }); location.href = new URLSearchParams(location.search).get('next') || '/dashboard'; return; } $EXTRA })()"
rm -rf $S/shots/$NAME; mkdir -p $S/shots/$NAME
$S/venv/bin/python $S/bin/audit.py "http://localhost:3190$URLPATH" --js "$JS" --wait ${WAIT:-4} --out $S/shots/$NAME ${WIDTHS:+--widths $WIDTHS} ${THEMES:+--themes $THEMES} 2>&1 | sed "s/$PW/***/g"
