#!/usr/bin/env bash
# Invoked over pinned SSH with ciphertext on stdin; no application env or keys.
set -euo pipefail
umask 077
export LC_ALL=C

[[ $(id -u) == 0 && $(hostname) == VM-11-154-ubuntu ]]
[[ $# == 2 || $# == 5 ]]
action=$1
backup_id=$2
[[ $backup_id =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}-[0-9]{2}-[0-9]{2}-[0-9]{3}Z$ ]]
root=/opt/sinegasi-backups
project=$root/production
destination=$project/$backup_id

private_directory() {
  [[ -d $1 && ! -L $1 && $(stat -c '%u:%g:%a' -- "$1") == 0:0:700 ]]
}

[[ -d /opt && ! -L /opt && $(stat -c '%u:%g' /opt) == 0:0 ]]
opt_mode=$(stat -c '%a' /opt)
(( (8#$opt_mode & 0022) == 0 ))

if [[ $action == init || $action == resume-empty ]]; then
  [[ $# == 2 ]]
  for directory in "$root" "$project"; do
    if [[ ! -e $directory && ! -L $directory ]]; then mkdir -m 700 -- "$directory"; fi
    private_directory "$directory"
  done
  # Resume is explicit and only accepts an entirely empty, private directory.
  if [[ $action == resume-empty ]]; then
    private_directory "$destination"
    [[ -z $(find "$destination" -mindepth 1 -maxdepth 1 -print -quit) ]]
  else
    mkdir -m 700 -- "$destination"
  fi
  private_directory "$destination"
  printf 'DESTINATION_CREATED\n'
  exit
fi

[[ $# == 5 && ( $action == upload || $action == verify ) ]]
private_directory "$root"
private_directory "$project"
private_directory "$destination"
filename=$3
expected_hash=$4
expected_bytes=$5
case "$filename" in
  database.dump.age|metadata.json.age|receipt.json|public-restore-verification.json|vps-copy-verification.json) ;;
  *) exit 1 ;;
esac
[[ $expected_hash =~ ^[0-9a-f]{64}$ && $expected_bytes =~ ^[1-9][0-9]{0,8}$ ]]
(( expected_bytes <= 268435456 ))
file=$destination/$filename
if [[ $action == upload ]]; then
  # Data artifact only: exclusive creation, no symlink following, fsync before ACK.
  dd of="$file" oflag=nofollow conv=excl,fsync status=none
fi
[[ -f $file && ! -L $file ]]
[[ $(stat -c '%u:%g:%a:%h:%s' -- "$file") == "0:0:600:1:$expected_bytes" ]]
actual_hash=$(sha256sum -- "$file")
[[ ${actual_hash%% *} == "$expected_hash" ]]
printf 'FILE_VERIFIED\n'
