# ⚡ performance-fix-v2 — Распакуйте в корень проекта

## 🚀 Установка (1 команда)

```bash
cd /path/to/your/project
tar -xzf performance-fix-v2.tar.gz
```

Перезапустите приложение. Готово.

---

## 📦 Содержимое

```
src/renderer/components/
├── SettingsModal.jsx   ← исправлен (v1, Painting: 1935ms → 55ms ✅)
├── SettingsModal.css   ← новый
├── TabBar.jsx          ← исправлен (v2, все 18 hover → CSS)
├── TabBar.css          ← новый
├── Sidebar.jsx         ← исправлен (v2, главный виновник System 3172ms)
└── Sidebar.css         ← новый
```

---

## 📊 Что изменилось в v2

### Главная проблема (System: 3172ms)

В `HostRow` (строка каждого хоста в Sidebar) был такой код:

```javascript
// ❌ БЫЛО: setState на каждый hover = React ре-рендер 20+ раз
const [hov, setHov] = useState(false)
onMouseEnter={() => setHov(true)}   // React re-render!
onMouseLeave={() => setHov(false)}  // React re-render!
background: hov ? 'var(--bg2)' : 'transparent'
```

При 20 хостах в списке и движении мыши = **20 синхронных React ре-рендеров**.

```javascript
// ✅ СТАЛО: ref для ping-триггера, CSS для визуала
const pingFetchedRef = useRef(false)
const handleMouseEnter = useCallback(() => {
  // Только если нужно запросить ping - без setState!
  if (pingFetchedRef.current) return
  pingFetchedRef.current = true
  window.api.host.ping(...).then(setPing)
}, [])
```

CSS управляет фоном:
```css
.host-row:hover { background: var(--bg2); }
.host-row:hover .ping-dot { display: inline-block; }
```

**Результат: 0 React ре-рендеров на hover хостов.**

### Плюс все `onMouseEnter/Leave` заменены на CSS `:hover`:

| Файл | До | После |
|------|----|-------|
| SettingsModal | 6 JS handlers | 0 |
| TabBar | 18 JS handlers | 0 |
| Sidebar | 24 JS handlers | 3 (нужные) |

---

## 📈 Ожидаемые результаты

| Метрика | v1 (было) | v2 (будет) |
|---------|-----------|------------|
| Painting | 55ms ✅ | 55ms |
| System | 3172ms ❌ | ~400ms |
| Rendering | 932ms | ~400ms |
| FPS | 30-40 | 55-60 |

---

## 🔄 Откат

```bash
git checkout src/renderer/components/Sidebar.jsx
git checkout src/renderer/components/TabBar.jsx
git checkout src/renderer/components/SettingsModal.jsx
rm src/renderer/components/Sidebar.css TabBar.css SettingsModal.css
```
