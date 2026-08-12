---

## 📁 File 4: `docs/04_UI_UX_DESIGN_RULES.md`

```markdown
# UI/UX Design System & Rule Specification
**Project Name:** Cinematography & Media Monitoring Dashboard (CMS Sinegasi Picture)
**Design System Standard:** Linear-Inspired Technical Dark Canvas (`#010102`)
**Iconography:** Lucide React Icons
**Styling Framework:** Tailwind CSS v3 + `clsx` + `tailwind-merge` (`cn` utility)

---

## 1. Full Design Tokens (YAML Specification)

```yaml
version: alpha
name: Linear-Sinegasi-Design-Analysis
description: "A near-black product-focused marketing and dashboard canvas built around #010102 (the deepest dark surface), light gray text (#f7f8f8), and the signature Linear lavender-blue (#5e6ad2) used as the single chromatic accent. The system reads as software-craft documentation: dense, technical, and quietly luxurious. Display type is set in the Linear custom sans (SF Pro Display / Inter fallback) at 500–700 with measured negative tracking. Cards live as charcoal panels (#0f1011) with hairline borders. The accent lavender appears on the brand mark, focus rings, and a few intentional CTAs — never decoratively."

colors:
  primary: "#5e6ad2"
  on-primary: "#ffffff"
  primary-hover: "#828fff"
  primary-focus: "#5e69d1"
  ink: "#f7f8f8"
  ink-muted: "#d0d6e0"
  ink-subtle: "#8a8f98"
  ink-tertiary: "#62666d"
  canvas: "#010102"
  surface-1: "#0f1011"
  surface-2: "#141516"
  surface-3: "#18191a"
  surface-4: "#191a1b"
  hairline: "#23252a"
  hairline-strong: "#34343a"
  hairline-tertiary: "#3e3e44"
  inverse-canvas: "#ffffff"
  inverse-surface-1: "#f5f6f6"
  inverse-surface-2: "#f6f7f7"
  inverse-ink: "#000000"
  brand-secure: "#7a7fad"
  semantic-success: "#27a644"
  semantic-warning: "#e2b340"
  semantic-danger: "#eb5757"
  semantic-overlay: "#000000"

typography:
  display-xl:
    fontFamily: Linear Display
    fontSize: 80px
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: -3.0px
  display-lg:
    fontFamily: Linear Display
    fontSize: 56px
    fontWeight: 600
    lineHeight: 1.10
    letterSpacing: -1.8px
  display-md:
    fontFamily: Linear Display
    fontSize: 40px
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: -1.0px
  headline:
    fontFamily: Linear Display
    fontSize: 28px
    fontWeight: 600
    lineHeight: 1.20
    letterSpacing: -0.6px
  card-title:
    fontFamily: Linear Display
    fontSize: 22px
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: -0.4px
  subhead:
    fontFamily: Linear Display
    fontSize: 20px
    fontWeight: 400
    lineHeight: 1.40
    letterSpacing: -0.2px
  body-lg:
    fontFamily: Linear Text
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.50
    letterSpacing: -0.1px
  body:
    fontFamily: Linear Text
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.50
    letterSpacing: -0.05px
  body-sm:
    fontFamily: Linear Text
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.50
    letterSpacing: 0
  caption:
    fontFamily: Linear Text
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.40
    letterSpacing: 0
  button:
    fontFamily: Linear Text
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.20
    letterSpacing: 0
  eyebrow:
    fontFamily: Linear Text
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.30
    letterSpacing: 0.4px
  mono:
    fontFamily: Linear Mono
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.50
    letterSpacing: 0

rounded:
  xs: 4px
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  xxl: 24px
  pill: 9999px
  full: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  section: 96px

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 8px 14px
  button-primary-pressed:
    backgroundColor: "{colors.primary-focus}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
  button-secondary:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 8px 14px
  button-tertiary:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 8px 14px
  button-inverse:
    backgroundColor: "{colors.inverse-canvas}"
    textColor: "{colors.inverse-ink}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 8px 14px
  pricing-card:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: 24px
  pricing-card-featured:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: 24px
  feature-card:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: 24px
  product-screenshot-card:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: 24px
  testimonial-card:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.body-lg}"
    rounded: "{rounded.lg}"
    padding: 32px
  customer-logo-tile:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-subtle}"
    typography: "{typography.caption}"
    rounded: "{rounded.xs}"
    padding: 16px
  text-input:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: 8px 12px
  text-input-focused:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: 8px 12px
  pricing-tab-default:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-subtle}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: 6px 14px
  pricing-tab-selected:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: 6px 14px
  cta-banner:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.headline}"
    rounded: "{rounded.lg}"
    padding: 48px
  changelog-row:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.xs}"
    padding: 24px 0
  status-badge:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: 2px 8px
  top-nav:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.xs}"
    height: 56px
  footer:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-subtle}"
    typography: "{typography.caption}"
    rounded: "{rounded.xs}"
    padding: 64px 32px
2. System Overview & Key CharacteristicsSistem antarmuka CMS Sinegasi Picture menggunakan deepest dark surface #010102 — hitam murni dengan sentuhan faint blue tint halus. Di atas canvas ini berdiri 4-step surface ladder (surface-1 hingga surface-4) untuk membentuk panel, kartu, dan flyout drawer. Pembatas menggunakan garis halus 1px (hairline borders) mulai dari #23252a hingga #3e3e44.  Aksen warna tunggal yang diizinkan adalah Linear Lavender-Blue (#5e6ad2) — digunakan hanya untuk brand mark, focus ring, tombol CTA utama, serta indikator aktif. Aplikasi menghindari gradien mencolok, spotlight card, ataupun warna aksen sekunder.  Key Characteristics:Dark-canvas marketing & dashboard system: {colors.canvas} (#010102).  Lavender-blue brand accent: {colors.primary} (#5e6ad2) digunakan secara terbatas pada brand mark, focus, dan primary CTA.  Four-step surface ladder: canvas $\rightarrow$ surface-1 $\rightarrow$ surface-2 $\rightarrow$ surface-3 $\rightarrow$ surface-4 membentuk hierarki tanpa bayangan berlebihan (drop shadow).  Display tracking negative: Penurunan letter-spacing tajam (-3.0px pada 80px); body tetap pada -0.05px.  Card geometry: Menggunakan {rounded.lg} (12px) dengan 1px hairline border.  Dense Product UI: Mengutamakan tangkapan antarmuka produk yang padat, teknis, dan presisi.  No second chromatic color: Tidak ada warna aksen kedua (orange, pink, purple). Tidak ada gradien atmosferik. Tidak ada spotlight card.  3. Detailed Color Breakdown & Configuration3.1 Color Palette BreakdownBrand & Accent:  Lavender-Blue ({colors.primary} / #5e6ad2): Signature Linear accent — primary CTA, brand mark, link emphasis.  Lavender Hover ({colors.primary-hover} / #828fff): State hover tombol primary.  Lavender Focus ({colors.primary-focus} / #5e69d1): Tint focus-ring untuk input dan tombol.  Brand Secure ({colors.brand-secure} / #7a7fad): Muted lavender-gray untuk indikator keamanan.  Surface:  Canvas ({colors.canvas} / #010102): Background utama aplikasi.  Surface 1 ({colors.surface-1} / #0f1011): Kartu fitur, panel tabel, container utama.  Surface 2 ({colors.surface-2} / #141516): Kartu aktif/terpilih, hovered row.  Surface 3 ({colors.surface-3} / #18191a): Sub-nav, dropdown menus, context Flyout.  Surface 4 ({colors.surface-4} / #191a1b): Modals, deepest lifted surface.  Hairline ({colors.hairline} / #23252a): Border 1px standar untuk kartu dan pembatas.  Hairline Strong ({colors.hairline-strong} / #34343a): Border 1px kuat untuk focus ring input.  Hairline Tertiary ({colors.hairline-tertiary} / #3e3e44): Border permukaan bertingkat.  Inverse Canvas ({colors.inverse-canvas} / #ffffff): Putih murni untuk pill CTA inversi.  Inverse Surface 1 & 2 (#f5f6f6 & #f6f7f7): Permukaan inversi.  Text:  Ink ({colors.ink} / #f7f8f8): Headlines dan teks utama.  Ink Muted ({colors.ink-muted} / #d0d6e0): Teks sekunder, metadata.  Ink Subtle ({colors.ink-subtle} / #8a8f98): Teks tersier, tab tidak aktif, label footer.  Ink Tertiary ({colors.ink-tertiary} / #62666d): Teks disabled, catatan kaki.  Semantic:  Success Green ({colors.semantic-success} / #27a644): Status badge sukses, indikator aktif.  Warning Yellow ({colors.semantic-warning} / #e2b340): Status pending, kerusakan ringan, izin/sakit.  Danger Red ({colors.semantic-danger} / #eb5757): Status alpa, hilang, kerusakan berat, rejected.  Overlay ({colors.semantic-overlay} / #000000): Background modal scrim.  3.2 Tailwind CSS Configuration (tailwind.config.js)JavaScript/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#010102",
        surface: {
          1: "#0f1011",
          2: "#141516",
          3: "#18191a",
          4: "#191a1b",
        },
        hairline: {
          DEFAULT: "#23252a",
          strong: "#34343a",
          tertiary: "#3e3e44",
        },
        primary: {
          DEFAULT: "#5e6ad2",
          hover: "#828fff",
          focus: "#5e69d1",
          foreground: "#ffffff",
        },
        ink: {
          DEFAULT: "#f7f8f8",
          muted: "#d0d6e0",
          subtle: "#8a8f98",
          tertiary: "#62666d",
        },
        semantic: {
          success: "#27a644",
          warning: "#e2b340",
          danger: "#eb5757",
        }
      }
    }
  },
  plugins: [],
}
4. Typography System & Hierarchy4.1 Font Family & Fallback StackLinear Display: Custom display sans; fallback SF Pro Display, -apple-system, system-ui, Segoe UI, Roboto, sans-serif.  Linear Text: Custom text sans; fallback stack yang sama.  Linear Mono: Custom mono; fallback JetBrains Mono, Geist Mono, ui-monospace, SF Mono, Menlo, monospace.  Note on Font Substitutes: Pada lingkungan open-source/cross-platform, Inter (weight 400 / 500 / 600 / 700) atau Geist Sans adalah pengganti gratis terbaik. Untuk monospace, gunakan JetBrains Mono atau Geist Mono.  4.2 Hierarchy TableTokenSizeWeightLine HeightLetter SpacingUsage Context  MD{typography.display-xl}80px6001.05-3.0pxHero stat / Landing headline terbesar  {typography.display-lg}56px6001.10-1.8pxSection opener headlines  {typography.display-md}40px6001.15-1.0pxSub-section headlines & Page titles  {typography.headline}28px6001.20-0.6pxModal titles, CTA banner heading  {typography.card-title}22px5001.25-0.4pxFeature card title, table section title  {typography.subhead}20px4001.40-0.2pxLead body, intro paragraphs  {typography.body-lg}18px4001.50-0.1pxHero subhead, lead paragraphs  {typography.body}16px4001.50-0.05pxDefault body text  {typography.body-sm}14px4001.500pxCard body, table cell data  {typography.caption}12px4001.400pxCaptions, meta info, status badges  {typography.button}14px5001.200pxAll button labels  {typography.eyebrow}13px5001.30+0.4pxSection eyebrow (positive tracking)  {typography.mono}13px4001.500pxCode snippets, QR keys, UUIDs, Logs  4.3 Typographic PrinciplesAggressive negative tracking on display: (-3.0px pada 80px $\approx$ 4% dari ukuran font).  Single voice from display to body: Display-xl (600) hingga body (400) berasal dari keluarga font yang sama.  Eyebrow uses positive tracking: (+0.4px) memberikan kontras taksonomi yang tegas.  Mono only in technical contexts: Monospace hanya digunakan di dalam tampilan QR Code Key, UUID, Log Activity, dan Nominal Kas.  5. Layout, Spacing & Whitespace Philosophy5.1 Spacing Scale (Base Unit: 4px){spacing.xxs}: 4px · {spacing.xs}: 8px · {spacing.sm}: 12px · {spacing.md}: 16px · {spacing.lg}: 24px · {spacing.xl}: 32px · {spacing.xxl}: 48px · {spacing.section}: 96px.  Card Interior Padding: {spacing.lg} (24px) pada feature/pricing card; {spacing.xl} (32px) pada testimonial card; {spacing.xxl} (48px) pada CTA banner.  Pill Button Padding: 8px vertical · 14px horizontal.  Form Input Padding: 8px vertical · 12px horizontal.  5.2 Grid & ContainerMax content width: ~1280px.  Card grids: 3-up pada desktop, 2-up pada tablet, 1-up pada mobile.  Product UI panels: Merentang penuh lebar konten sebagai fokus utama.  5.3 Whitespace PhilosophyDark canvas ADALAH whitespace itu sendiri. Pemisahan antar seksi dilakukan dengan surface lift ke panel {colors.surface-1}, bukan dengan celah putih. Di dalam panel, jarak antar blok konten menggunakan {spacing.lg} (24px), sedangkan antar seksi utama menggunakan {spacing.section} (96px).  6. Elevation, Depth & Shapes6.1 Elevation Level TableLevelTreatmentUsage Context  MD0 (flat)No shadow, no borderDefault body, hero text, canvas background  1 (charcoal lift){colors.surface-1} bg, 1px {colors.hairline}Default cards, table panels, screenshot frames  2 (surface-2 lift){colors.surface-2} bg, 1px {colors.hairline-strong}Featured cards, hovered cards, active row  3 (surface-3 lift){colors.surface-3} bgSub-nav, dropdown menus, flyout drawers  4 (focus ring)2px {colors.primary-focus} outline at 50% opacityFocused input, focused button  6.2 Decorative DepthProduct UI Screenshots / Panels mendominasi sebagai kedalaman dekoratif.  Tidak ada gradien atmosferik, tidak ada spotlight card.  Subtle white edge highlight: Garis putih sangat halus di tepi atas panel yang terangkat untuk memberikan efek "pixel rendered".  6.3 Border Radius ScaleTokenValueUsage Context  MD{rounded.xs}4pxSmall chips, status badges, log tag  {rounded.sm}6pxInline tags  {rounded.md}8pxAll buttons, form inputs  {rounded.lg}12pxPricing cards, feature cards, testimonial cards  {rounded.xl}16pxProduct screenshot panels, equipment frames  {rounded.xxl}24pxOversized CTA banners  {rounded.pill}9999pxToggle tabs, status pills  {rounded.full}9999pxAvatar circles  7. Component Specifications7.1 Buttonsbutton-primary: Lavender CTA utama (bg-primary text-on-primary text-sm font-medium px-3.5 py-2 rounded-md hover:bg-primary-hover focus:ring-2 focus:ring-primary-focus).  button-secondary: Charcoal button (bg-surface-1 text-ink text-sm font-medium px-3.5 py-2 rounded-md border border-hairline hover:bg-surface-2).  button-tertiary: Plain text button (bg-canvas text-ink text-sm font-medium px-3.5 py-2 rounded-md hover:bg-surface-1).  button-inverse: White-on-dark CTA (bg-inverse-canvas text-inverse-ink text-sm font-medium px-3.5 py-2 rounded-md).  7.2 Inputs & Formstext-input: Background {colors.surface-1}, text {colors.ink}, rounded {rounded.md} (8px), padding 8px 12px, border 1px {colors.hairline}.  text-input-focused: Border berubah ke {colors.hairline-strong} dengan 2px {colors.primary-focus} ring di 50% opacity.  7.3 Cards & Containerspricing-card / feature-card: Background {colors.surface-1}, text {colors.ink}, rounded {rounded.lg} (12px), padding 24px, border 1px {colors.hairline}.  product-screenshot-card: Frame foto/UI berukuran besar, background {colors.surface-1}, rounded {rounded.xl} (16px), padding 24px.  testimonial-card: Background {colors.surface-1}, rounded {rounded.lg} (12px), padding 32px.  customer-logo-tile: Background {colors.canvas}, rounded {rounded.xs} (4px), padding 16px.  cta-banner: Background {colors.surface-1}, rounded {rounded.lg} (12px), padding 48px.  7.4 Tabs, Navigation & Statuspricing-tab-default: Background {colors.canvas}, text {colors.ink-subtle}, rounded {rounded.pill}, padding 6px 14px.  pricing-tab-selected: Background {colors.surface-2}, text {colors.ink}, rounded {rounded.pill}, padding 6px 14px.  top-nav: Height 56px, background {colors.canvas}, border-b 1px {colors.hairline}.  changelog-row: Background {colors.canvas}, padding 24px 0, border-b 1px {colors.hairline}.  status-badge: Background {colors.surface-2}, text {colors.ink-muted}, rounded {rounded.pill}, padding 2px 8px, font size 12px.  8. Iconography Mapping (Lucide React)Gunakan Lucide React dengan prop strokeWidth={1.75} dan ukuran 16px hingga 20px:  Sidebar Navigation: LayoutDashboard, Users, CalendarCheck, Wallet, GraduationCap, Camera, PackageCheck, Trophy, Settings, LogOut.Actions & Controls: Plus, Search, Filter, MoreVertical, CheckCircle2, XCircle, AlertTriangle, Lock, Unlock, QrCode, UploadCloud, ExternalLink, ChevronDown.Media & File: Image, FileText, Eye, Download.9. Do's and Don'ts✅ DoJadikan {colors.canvas} (#010102) sebagai landasan utama sistem.  Gunakan {colors.primary} Lavender HANYA untuk brand mark, primary CTA, focus ring, dan indikator aktif.  Manfaatkan 4-step surface ladder untuk mengatur hierarki tanpa drop shadow tebal.  Padukan display weight 600 dengan body weight 400.  Terapkan negative letter-spacing secara agresif pada display type.  Tampilkan screenshot UI produk sebagai elemen visual utama.  Gunakan {rounded.md} (8px) untuk seluruh tombol CTA.  ❌ Don'tDilarang membuat halaman mode terang (Light Mode).  Dilarang menggunakan warna Lavender sebagai background seksi atau kartu penuh.  Dilarang memasukkan warna aksen sekunder (orange, pink, green untuk marketing).  Dilarang menambahkan gradien atmosferik atau spotlight card.  Dilarang membuat tombol CTA berbentuk pill/kapsul.  Dilarang menggunakan hitam murni #000000 sebagai background canvas utama.  Dilarang menggabungkan banyak warna menyala dalam satu mockup UI.  10. Responsive Behavior & Collapsing Strategy10.1 Breakpoint ScaleNameWidthKey Changes  MDDesktop-XL1440pxDefault desktop layout  Desktop1280pxCard grid 3-up terlayani  Tablet1024pxCard grid 3-up $\rightarrow$ 2-up  Mobile-Lg768pxNavigasi berubah ke hamburger menu; tabel perbandingan menjadi akordeon  Mobile480pxLayout 1 kolom; display-xl menyusut dari 80px ke ~36px  10.2 Touch Targets & Collapsing RulesTouch Targets: Seluruh CTA mempertahankan tinggi sentuhan $\ge 40\text{px}$ ($\ge 44\text{px}$ untuk form input dan pill toggle pada layar sentuh).  Collapsing Strategy: Top nav runtuh ke hamburger menu di bawah 768px; Grid kartu menyusut dari 3-up $\rightarrow$ 2-up $\rightarrow$ 1-up.  Image Behavior: Screenshot UI produk mempertahankan aspect ratio asli dan tidak pernah terpotong (never crop).  11. Iteration Guide & Known Gaps11.1 Iteration GuideFokus pada SATU komponen dalam satu waktu dan acu dengan token components: nya.  Saat membuat seksi baru, tentukan level surface lift tempat seksi tersebut berada.  Default teks body ke {typography.body} pada weight 400.  Jalankan npx @google/design.md lint DESIGN.md setelah melakukan pengubahan.  Tambahkan varian baru sebagai entri komponen terpisah.  Perlakukan warna Lavender sebagai barang langka: brand mark, primary CTA, focus, link emphasis.  Pimpin setiap seksi dengan tangkapan antarmuka UI produk.  11.2 Known GapsNilai 4-step surface ladder diekstrak langsung dari variabel CSS --color-bg-level-3 milik Linear.  Tampilan error form field dan validasi dipetakan menggunakan warna semantic danger (#eb5757)[cite: 1].Light mode tidak didokumentasikan karena sistem tidak mendukung mode terang[cite: 1].UI internal produk dapat menggunakan warna tag sekunder (merah, orange, kuning, hijau, biru) khusus untuk status prioritas dan label proyek[cite: 1].Font khusus (Linear Display/Text/Mono) dapat digantikan oleh Inter, Geist Sans, JetBrains Mono, atau Geist Mono[cite: 1].
```
