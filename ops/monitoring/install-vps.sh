#!/bin/bash
# Fresh, versioned installation only. Review code and checksums before sudo.
set +x
set -euo pipefail
umask 077
export PATH=/usr/sbin:/usr/bin:/sbin:/bin

[[ $EUID == 0 && $(uname -s) == Linux && $(hostname) == VM-11-154-ubuntu ]] || {
  printf '%s\n' 'STOP: gunakan sudo di VPS VM-11-154-ubuntu.' >&2
  exit 1
}

source_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
version=/usr/local/lib/sinegasi-monitor-v1
wrapper=/usr/local/sbin/sinegasi-monitor
state=/var/lib/sinegasi-monitor
cron=/etc/cron.d/sinegasi-monitor
for target in "$version" "$wrapper" "$state" "$cron"; do
  [[ ! -e $target && ! -L $target ]] || {
    printf '%s\n' 'STOP: target instalasi sudah ada; tidak menimpa konfigurasi/histori.' >&2
    exit 1
  }
done
for parent in /usr/local/lib /usr/local/sbin /var/lib /etc/cron.d; do
  [[ -d $parent && ! -L $parent && $(stat -c '%u' "$parent") == 0 ]] || exit 1
  mode=$(stat -c '%a' "$parent")
  (( (8#$mode & 0022) == 0 )) || exit 1
done
for source in monitor_vps.py control-vps.sh; do
  [[ -f $source_dir/$source && ! -L $source_dir/$source && $(stat -c '%h' "$source_dir/$source") == 1 ]] || exit 1
done
[[ -x /usr/bin/python3 && -x /usr/bin/timeout && -x /usr/bin/docker ]] || exit 1
/usr/bin/systemctl is-active --quiet cron || { printf '%s\n' 'STOP: layanan cron belum aktif.' >&2; exit 1; }
/usr/bin/python3 -I -c 'import ast, pathlib, sys; ast.parse(pathlib.Path(sys.argv[1]).read_text())' "$source_dir/monitor_vps.py"
/bin/bash -n "$source_dir/control-vps.sh"

stage=$(mktemp -d /usr/local/lib/.sinegasi-monitor-install.XXXXXX)
wrapper_stage=''
cleanup() {
  if [[ -n ${wrapper_stage:-} ]]; then rm -f -- "$wrapper_stage"; fi
  if [[ -n ${stage:-} ]]; then
    rm -f -- "$stage/monitor_vps.py" "$stage/control-vps.sh"
    rmdir -- "$stage"
  fi
}
trap cleanup EXIT
install -o root -g root -m 600 "$source_dir/monitor_vps.py" "$stage/monitor_vps.py"
install -o root -g root -m 700 "$source_dir/control-vps.sh" "$stage/control-vps.sh"
chmod 700 "$stage"
# -T prevents nesting inside an existing destination; target prechecked above.
mv -T -- "$stage" "$version"
stage=''
install -d -o root -g root -m 700 "$state"
install -o root -g root -m 600 /dev/null "$state/lock"
wrapper_stage=$(mktemp /usr/local/sbin/.sinegasi-monitor.XXXXXX)
printf '%s\n' '#!/bin/sh' 'exec /usr/bin/python3 -I -B /usr/local/lib/sinegasi-monitor-v1/monitor_vps.py "$@"' > "$wrapper_stage"
chown root:root "$wrapper_stage"
chmod 755 "$wrapper_stage"
ln -- "$wrapper_stage" "$wrapper"
rm -f -- "$wrapper_stage"
wrapper_stage=''
"$wrapper" --help >/dev/null
/bin/bash "$version/control-vps.sh" enable
printf '%s\n' 'MONITOR_INSTALLED — cron aktif; belum membuktikan pengumpulan pertama berhasil.'
printf '%s\n' 'Berikutnya: sudo /usr/local/sbin/sinegasi-monitor collect'
printf '%s\n' 'Lalu: sudo /usr/local/sbin/sinegasi-monitor report'
