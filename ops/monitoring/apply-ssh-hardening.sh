#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
[[ "$(id -u)" == 0 && "$(hostname)" == VM-11-154-ubuntu ]] || exit 1
[[ $# == 1 && "$1" == /tmp/sinegasi-ssh-stage.* && -d "$1" && ! -L "$1" ]] || exit 1
stage="$1"
config=/etc/ssh/sshd_config.d/00-sinegasi-hardening.conf
state=/var/lib/sinegasi-ssh-hardening
code=/usr/local/lib/sinegasi-ssh-hardening-v1
[[ -d /etc/ssh/sshd_config.d && ! -L /etc/ssh/sshd_config.d ]] || exit 1
for target in "$config" "$state" "$code"; do
  [[ ! -e "$target" && ! -L "$target" ]] || {
    printf '%s\n' 'STOP: existing SSH-hardening target; inspect before retry.' >&2
    exit 1
  }
done
for name in ssh-hardening.conf rollback-ssh-hardening.sh; do
  [[ -f "$stage/$name" && ! -L "$stage/$name" && "$(stat -c '%h' "$stage/$name")" == 1 ]] || exit 1
done
/usr/sbin/sshd -t
install -d -o root -g root -m 700 "$state" "$code"
install -o root -g root -m 600 /etc/ssh/sshd_config "$state/sshd_config.before"
install -o root -g root -m 700 "$stage/rollback-ssh-hardening.sh" "$code/rollback.sh"
install -o root -g root -m 600 "$stage/ssh-hardening.conf" "$state/candidate.conf"
sha256sum "$state/sshd_config.before"
# Prepare recovery before publishing configuration. The callback is root-owned.
/usr/bin/systemd-run --quiet --unit=sinegasi-ssh-hardening-rollback \
  --on-active=5m --timer-property=AccuracySec=1s "$code/rollback.sh"
install -o root -g root -m 600 "$state/candidate.conf" "$config"
(cd /etc/ssh/sshd_config.d && sha256sum 00-sinegasi-hardening.conf) > "$state/installed.sha256"
trap '"$code/rollback.sh"' ERR
/usr/sbin/sshd -t
effective="$(/usr/sbin/sshd -T)"
for expected in 'permitrootlogin no' 'passwordauthentication no' \
  'kbdinteractiveauthentication no' 'pubkeyauthentication yes' 'authenticationmethods publickey'; do
  grep -Fx -- "$expected" <<< "$effective" >/dev/null
done
/usr/bin/systemctl reload ssh
trap - ERR
printf '%s\n' 'SSH_HARDENING_APPLIED_VERIFY_NEW_CONNECTION_WITHIN_5_MINUTES'
