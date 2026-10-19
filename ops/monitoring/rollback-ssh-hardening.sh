#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
[[ "$(id -u)" == 0 && "$(hostname)" == VM-11-154-ubuntu ]] || exit 1
state=/var/lib/sinegasi-ssh-hardening
config=/etc/ssh/sshd_config.d/00-sinegasi-hardening.conf
[[ -d "$state" && ! -L "$state" && "$(stat -c '%u:%g:%a' "$state")" == 0:0:700 ]] || exit 1
[[ ! -e "$state/confirmed" && ! -L "$state/confirmed" ]] || {
  printf '%s\n' 'SSH_HARDENING_CONFIRMED_NO_ROLLBACK'
  exit 0
}
[[ -f "$config" && ! -L "$config" && "$(stat -c '%u:%g:%h' "$config")" == 0:0:1 ]] || exit 1
[[ ! -e "$state/disabled.conf" && ! -L "$state/disabled.conf" ]] || exit 1
[[ -f "$state/installed.sha256" && ! -L "$state/installed.sha256" ]] || exit 1
cd /etc/ssh/sshd_config.d
sha256sum --status --check "$state/installed.sha256"
mv -T -- "$config" "$state/disabled.conf"
/usr/sbin/sshd -t
/usr/bin/systemctl reload ssh
printf '%s\n' 'SSH_HARDENING_ROLLED_BACK'
