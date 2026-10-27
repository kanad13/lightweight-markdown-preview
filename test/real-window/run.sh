#!/bin/zsh
# Real-window check of the preview in one VS Code build.
#
# usage: test/real-window/run.sh <label> <path to the VS Code executable>
#   macOS: ".../Visual Studio Code.app/Contents/MacOS/Code" (Stable), or ".../Electron" for older builds such as 1.105.0
#
# Needs: the d2-renderer container named d2-test on http://localhost:8080 (ask the maintainer to start it), `npm run build`
# done, and Node 22 or later. Run it in VS Code Stable, and before a release in the engines.vscode floor.
# LMP_HOME is a short folder for the profile, because VS Code's socket path must stay under about 100 characters.
set -u
LABEL=$1; BIN=$2
ROOT=${0:A:h:h:h}
HOME_DIR=${LMP_HOME:-$HOME/.lmpv}
UD=$HOME_DIR/ud-$LABEL
WS=$HOME_DIR/ws
cdp() { node $ROOT/test/real-window/cdp.js "$@"; }
export LMP_CMD=$HOME_DIR/cmd.json

mkdir -p $UD/User $WS/docs $WS/assets
cp $ROOT/examples/showcase.md $WS/showcase.md; cp $ROOT/examples/test.md $WS/plain.md
cp $ROOT/docs/d2.md $WS/docs/d2.md; rm -rf $WS/docs/d2; cp -r $ROOT/docs/d2 $WS/docs/d2; cp $ROOT/assets/readme-d2-*.png $WS/assets/
cat > $UD/User/settings.json <<'JSON'
{ "workbench.colorTheme": "Default Light Modern", "window.restoreWindows": "none", "workbench.startupEditor": "none",
  "telemetry.telemetryLevel": "off", "update.mode": "none", "extensions.autoUpdate": false, "extensions.autoCheckUpdates": false }
JSON

drv() { rm -f $LMP_CMD.out; echo "$1" > $LMP_CMD.tmp && mv $LMP_CMD.tmp $LMP_CMD
	for i in {1..80}; do [ -f $LMP_CMD.out ] && { cat $LMP_CMD.out; echo; return; }; sleep 0.5; done; echo TIMEOUT; }
cnt() { docker logs d2-test 2>&1 | grep -c "GET /d2/svg"; }
ev() { cdp eval "$1"; }
edit() { drv "{\"op\":\"open\",\"file\":\"$WS/$1\"}" >/dev/null; sleep 1; drv "{\"op\":\"edit\",\"from\":\"$2\",\"to\":\"$3\"}"; }

curl -fs localhost:8080/health >/dev/null || { echo "No renderer on localhost:8080. Ask the maintainer to start the d2-renderer container."; exit 1; }
rm -f $LMP_CMD*
nohup "$BIN" --user-data-dir=$UD --extensions-dir=$HOME_DIR/ext-$LABEL --extensionDevelopmentPath=$ROOT --extensionDevelopmentPath=$ROOT/test/real-window/driver \
	--remote-debugging-port=9222 --new-window $WS > $HOME_DIR/code-$LABEL.log 2>&1 &
for i in {1..60}; do [ -f $LMP_CMD.ready ] && break; sleep 1; done

echo "### $LABEL: $(drv '{"op":"info"}')"
drv "{\"op\":\"open\",\"file\":\"$WS/showcase.md\"}" >/dev/null; drv '{"op":"preview"}' >/dev/null; sleep 7
echo "1 no renderer: $(ev "({imgs:document.querySelectorAll('img.d2-img').length, hints:document.querySelectorAll('.d2-hint').length, d2code:document.querySelectorAll('code.language-d2').length, mermaid:document.querySelectorAll('.mermaid svg').length, math:document.querySelectorAll('mjx-container').length})")"
drv "{\"op\":\"open\",\"file\":\"$WS/plain.md\"}" >/dev/null; sleep 4
echo "2 document without D2: $(ev "({d2Elements:document.querySelectorAll('[class*=d2-]').length})")"
drv "{\"op\":\"open\",\"file\":\"$WS/showcase.md\"}" >/dev/null; sleep 2
B=$(cnt); rm -f $LMP_CMD.out; echo '{"op":"exec","command":"lightweightMarkdownViewer.chooseD2Renderer"}' > $LMP_CMD; sleep 3
echo "3 quick pick: $(cdp main "document.querySelector('.quick-input-widget')?.innerText.replace(/\n+/g,' | ').slice(0,120)")"
drv '{"op":"exec","command":"workbench.action.acceptSelectedQuickOpenItem"}' >/dev/null; sleep 7
echo "  chosen: $(drv '{"op":"info"}') $(ev "({imgs:document.querySelectorAll('img.d2-img').length, ok:[...document.querySelectorAll('img.d2-img')].every(i=>i.naturalWidth>0)})") requests +$(( $(cnt) - B ))"
for t in "Default Dark Modern" "Default High Contrast" "Default High Contrast Light" "Default Light Modern"; do
	drv "{\"op\":\"theme\",\"name\":\"$t\"}" >/dev/null; sleep 5
	echo "4 $t: $(ev "({q:[...new Set([...document.querySelectorAll('img.d2-img')].map(i=>i.src.split('?')[1]))], ok:[...document.querySelectorAll('img.d2-img')].every(i=>i.naturalWidth>0)})")"
done
ev "(window.scrollTo(0,500), new Promise(r=>setTimeout(()=>r(window.scrollY),600)))" >/dev/null
B=$(cnt); edit showcase.md "Standby database" "Standby replica" >/dev/null; sleep 5
echo "5 edit one D2 block: requests +$(( $(cnt) - B )), scrollY $(ev 'window.scrollY'), drawn $(ev "[...document.querySelectorAll('img.d2-img')].every(i=>i.naturalWidth>0)")"
B=$(cnt); edit showcase.md "A short design note" "A brief design note" >/dev/null; sleep 5; echo "6 edit prose: requests +$(( $(cnt) - B ))"
edit showcase.md "Standby replica" "Standby database" >/dev/null; edit showcase.md "A brief design note" "A short design note" >/dev/null; sleep 3
drv "{\"op\":\"open\",\"file\":\"$WS/docs/d2.md\"}" >/dev/null; sleep 1; drv '{"op":"preview"}' >/dev/null; sleep 9
echo "7 guide: $(ev "({live:[...document.querySelectorAll('img.d2-img')].map(i=>i.naturalWidth>0), copies:[...document.images].filter(i=>/\/d2\/[a-z]+\.svg/.test(i.src)).map(i=>i.naturalWidth>0), shots:[...document.images].filter(i=>/assets\//.test(i.src)).map(i=>i.naturalWidth>0)})")"
drv "{\"op\":\"open\",\"file\":\"$WS/showcase.md\"}" >/dev/null; sleep 3
for v in "" "javascript:alert(1)" "http://localhost:9"; do
	drv "{\"op\":\"config\",\"key\":\"lightweightMarkdownViewer.d2.rendererUrl\",\"value\":\"$v\"}" >/dev/null; sleep 5
	echo "8 setting '$v': $(ev "({imgs:document.querySelectorAll('img.d2-img').length, hints:document.querySelectorAll('.d2-hint').length, notice:document.querySelector('.d2-notice strong')?.textContent, failBoxes:[...document.querySelectorAll('.d2-error')].filter(e=>!e.hidden).length, brokenShown:[...document.querySelectorAll('img.d2-img')].filter(i=>!i.hidden).length})")"
done
pkill -f "$UD"; sleep 3; pkill -9 -f "$UD" 2>/dev/null
echo "### $LABEL done"
