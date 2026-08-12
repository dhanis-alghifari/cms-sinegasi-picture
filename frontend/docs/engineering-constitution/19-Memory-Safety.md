# 19-Memory-Safety.md

# React Memory Safety

## Status

Mandatory

------------------------------------------------------------------------

# Purpose

Dokumen ini mendefinisikan aturan Memory Safety untuk seluruh React
Enterprise Dashboard CMS.

## Golden Rule

> If you create it, you clean it.

Setiap resource yang dibuat harus memiliki lifecycle dan cleanup yang
jelas.

------------------------------------------------------------------------

# Resource Ownership

Setiap resource harus memiliki tepat satu owner yang bertanggung jawab
atas:

-   Creation
-   Lifecycle
-   Cleanup
-   Disposal

------------------------------------------------------------------------

# Resource Checklist

Semua resource berikut wajib memiliki cleanup:

-   Event Listener
-   setTimeout
-   setInterval
-   ResizeObserver
-   MutationObserver
-   IntersectionObserver
-   WebSocket
-   Server Sent Events
-   Subscription
-   MediaQuery Listener
-   AbortController
-   Geolocation Watcher

------------------------------------------------------------------------

# Event Listener

Bad

``` tsx
useEffect(() => {
  window.addEventListener("resize", onResize)
}, [])
```

Good

``` tsx
useEffect(() => {
  window.addEventListener("resize", onResize)

  return () => {
    window.removeEventListener("resize", onResize)
  }
}, [])
```

------------------------------------------------------------------------

# Timers

``` tsx
const timer = setTimeout(work, 1000)

return () => clearTimeout(timer)
```

``` tsx
const interval = setInterval(work, 1000)

return () => clearInterval(interval)
```

------------------------------------------------------------------------

# Observers

Seluruh observer wajib diputus saat unmount.

``` tsx
observer.disconnect()
```

------------------------------------------------------------------------

# WebSocket

``` tsx
socket.on("message", handler)

return () => {
  socket.off("message", handler)
  socket.close()
}
```

------------------------------------------------------------------------

# Async Requests

Gunakan AbortController atau mekanisme pembatalan library bila tersedia.

Tujuan:

-   mengurangi pekerjaan async yang tidak diperlukan
-   mencegah update setelah komponen tidak aktif
-   menghemat resource

------------------------------------------------------------------------

# Stale Closure

Evaluasi dependency `useEffect`.

Pastikan callback tidak membaca state lama secara tidak sengaja.

------------------------------------------------------------------------

# Zombie Update

Jangan memperbarui state setelah komponen tidak aktif.

Batalkan pekerjaan async atau gunakan mekanisme lifecycle yang sesuai.

------------------------------------------------------------------------

# TanStack Query

Jika menggunakan TanStack Query, jangan membuat fetch manual yang
menduplikasi lifecycle query.

------------------------------------------------------------------------

# AI Mandatory Explanation

Jika membuat:

-   useEffect
-   useLayoutEffect
-   Event Listener
-   Observer
-   Timer
-   Subscription

AI wajib menjelaskan:

1.  Mengapa cleanup diperlukan.
2.  Kapan cleanup dijalankan.
3.  Apa yang terjadi saat unmount.
4.  Memory leak yang dicegah.
5.  Alasan memilih strategi tersebut.

------------------------------------------------------------------------

# Decision Tree

``` text
Need external resource?
        │
        ▼
Need cleanup?
        │
      Always
        ▼
Implement Cleanup
        ▼
Explain Unmount
```

------------------------------------------------------------------------

# Code Review Checklist

-   [ ] Listener dibersihkan
-   [ ] Timer dibersihkan
-   [ ] Interval dibersihkan
-   [ ] Observer disconnect
-   [ ] Subscription unsubscribe
-   [ ] Async dibatalkan bila memungkinkan
-   [ ] Tidak ada zombie update
-   [ ] Cleanup dijelaskan
-   [ ] Unmount dijelaskan

------------------------------------------------------------------------

# Next

20-Accessibility.md
