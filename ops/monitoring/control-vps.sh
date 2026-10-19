#!/bin/bash
# Versioned monitor control. Does not restart SSH, Docker or the application.
set +x
set -euo pipefail
umask 077
export PATH=/usr/sbin:/usr/bin:/sbin:/bin

[[ $EUID == 0 && $(uname -s) == Linux && $(hostname) == VM-11-154-ubuntu ]] || {
  printf '%s\n' 'STOP: gunakan sudo di VPS VM-11-154-ubuntu.' >&2
  exit 1
}

state=/var/lib/sinegasi-monitor
cron=/etc/cron.d/sinegasi-monitor
[[ -d $state && ! -L $state && $(stat -c '%u:%a' "$state") == 0:700 ]] || exit 1
cron_text='# Sinegasi: kumpulkan subset log aman tiap 5 menit, menit 03,08,...,58 (semua hari).
# Interval selalu 5 menit; tidak mengubah zona waktu server atau cron backup.
SHELL=/bin/sh
PATH=/usr/sbin:/usr/bin:/sbin:/bin
3-59/5 * * * * root /usr/bin/env -i PATH=/usr/sbin:/usr/bin:/sbin:/bin LC_ALL=C /usr/bin/timeout --kill-after=2s 45s /usr/local/sbin/sinegasi-monitor collect >/dev/null 2>&1'

matches_cron() {
  [[ -f $cron && ! -L $cron && $(stat -c '%u:%a:%h' "$cron") == 0:644:1 ]] &&
    cmp -s "$cron" <(printf '%s\n' "$cron_text")
}

case ${1:-status} in
  status)
    if matches_cron; then
      printf '%s\n' 'MONITOR_CRON_ENABLED — tiap 5 menit pada 03,08,...,58.'
    elif [[ ! -e $cron && ! -L $cron ]]; then
      printf '%s\n' 'MONITOR_CRON_DISABLED'
    else
      printf '%s\n' 'STOP: cron berbeda/tidak aman; tidak diubah.' >&2
      exit 1
    fi
    ;;
  enable)
    if matches_cron; then printf '%s\n' MONITOR_CRON_ALREADY_ENABLED; exit 0; fi
    [[ ! -e $cron && ! -L $cron ]] || { printf '%s\n' 'STOP: tujuan cron sudah ada.' >&2; exit 1; }
    tmp=$(mktemp /etc/cron.d/.sinegasi-monitor.XXXXXX)
    trap '[[ -z ${tmp:-} ]] || rm -f -- "$tmp"' EXIT
    printf '%s\n' "$cron_text" > "$tmp"
    chmod 644 "$tmp"
    chown root:root "$tmp"
    # link fails atomically if another administrator created the target.
    ln -- "$tmp" "$cron"
    rm -f -- "$tmp"
    tmp=''
    printf '%s\n' MONITOR_CRON_ENABLED
    ;;
  disable)
    [[ -e $cron || -L $cron ]] || { printf '%s\n' MONITOR_CRON_ALREADY_DISABLED; exit 0; }
    matches_cron || { printf '%s\n' 'STOP: cron tidak cocok; tidak diubah.' >&2; exit 1; }
    disabled="$state/cron.disabled"
    if [[ -e $disabled || -L $disabled ]]; then
      [[ -f $disabled && ! -L $disabled && $(stat -c '%u:%a:%h' "$disabled") == 0:600:1 ]] &&
        cmp -s "$disabled" <(printf '%s\n' "$cron_text") || {
          printf '%s\n' 'STOP: arsip cron berbeda/tidak aman; tidak ditimpa.' >&2
          exit 1
        }
    fi
    mv -T -- "$cron" "$disabled"
    chmod 600 "$disabled"
    printf '%s\n' 'MONITOR_CRON_DISABLED — konfigurasi disimpan di state/cron.disabled; histori tetap ada.'
    ;;
  *) printf '%s\n' 'Gunakan: control-vps.sh status|enable|disable' >&2; exit 1 ;;
esac
