# Notifications module

Semua list/read operation di-scope ke user yang sedang login. Route menjaga
auth/schema, service memetakan identity dan error, repository memakai explicit
select, unread count, deterministic ordering, dan adapter memory. Periksa index
user/sort serta partial unread pada migration `031_*`.
