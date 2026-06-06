import React from 'react'

const SECTIONS = [
  {
    title: 'Навигация по вкладкам',
    keys: [
      { keys: ['Ctrl', 'Tab'],         desc: 'Следующая вкладка' },
      { keys: ['Ctrl', 'Shift', 'Tab'], desc: 'Предыдущая вкладка' },
      { keys: ['Ctrl', '1–9'],          desc: 'Перейти к вкладке по номеру' },
      { keys: ['Ctrl', 'W'],            desc: 'Закрыть активную вкладку' },
      { keys: ['F11'],                  desc: 'Полноэкранный режим' },
    ],
  },
  {
    title: 'Broadcast — отправка во все панели',
    keys: [
      { keys: ['Enter'],               desc: 'Отправить команду' },
      { keys: ['Shift', 'Enter'],      desc: 'Перенос строки (многострочная команда)' },
      { keys: ['↑', '↓'],              desc: 'Навигация по истории' },
      { keys: ['Ctrl', 'H'],           desc: 'Открыть / закрыть историю' },
      { keys: ['Tab'],                  desc: 'Автодополнение команды (SSH-хосты)' },
      { keys: ['Shift', 'Tab'],        desc: 'Предыдущий вариант дополнения' },
      { keys: ['Escape'],              desc: 'Очистить поле / закрыть popup' },
      { keys: ['^C'],                  desc: 'Ctrl+C во все панели (SIGINT)' },
      { keys: ['^Z'],                  desc: 'Ctrl+Z во все панели (SIGTSTP)' },
      { keys: ['^D'],                  desc: 'Ctrl+D во все панели (EOF)' },
      { keys: ['^L'],                  desc: 'Ctrl+L во все панели (очистить экран)' },
    ],
  },
  {
    title: 'Терминал',
    keys: [
      { keys: ['Ctrl', 'C'],           desc: 'Прервать процесс (SIGINT)' },
      { keys: ['Ctrl', 'Z'],           desc: 'Приостановить процесс (SIGTSTP)' },
      { keys: ['Ctrl', 'D'],           desc: 'Конец ввода / выйти из shell' },
      { keys: ['Ctrl', 'L'],           desc: 'Очистить экран' },
      { keys: ['Ctrl', 'R'],           desc: 'Поиск в истории bash' },
      { keys: ['Ctrl', 'A'],           desc: 'В начало строки' },
      { keys: ['Ctrl', 'E'],           desc: 'В конец строки' },
      { keys: ['Ctrl', 'U'],           desc: 'Удалить строку до курсора' },
    ],
  },
  {
    title: 'SFTP-панель',
    keys: [
      { keys: ['Двойной клик'],        desc: 'Открыть файл / войти в папку' },
      { keys: ['ПКМ'],                  desc: 'Контекстное меню' },
      { keys: ['Drag & Drop'],          desc: 'Загрузить файл с локальной машины' },
    ],
  },
]

function Key({ label }) {
  return (
    <kbd style={{
      display: 'inline-block',
      padding: '1px 6px',
      fontSize: 11,
      fontFamily: 'var(--font-mono)',
      background: 'var(--bg3)',
      border: '1px solid var(--border2)',
      borderBottomWidth: 2,
      borderRadius: 4,
      color: 'var(--text0)',
      whiteSpace: 'nowrap',
    }}>{label}</kbd>
  )
}

export default function HotkeyHelp({ onClose }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 4000,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg1)',
          border: '1px solid var(--border2)',
          borderRadius: 12,
          width: 580,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
          overflow: 'hidden',
        }}
      >
        {/* Шапка */}
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: '14px 20px 12px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text0)' }}>
            ⌨ Горячие клавиши
          </span>
          <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text3)' }}>F1</span>
          <button
            onClick={onClose}
            style={{
              marginLeft: 'auto', fontSize: 18, color: 'var(--text3)',
              background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1, padding: 0,
            }}
          >×</button>
        </div>

        {/* Контент */}
        <div style={{ overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {SECTIONS.map(section => (
            <div key={section.title}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: 'var(--text3)',
                textTransform: 'uppercase', letterSpacing: '0.5px',
                marginBottom: 8,
              }}>
                {section.title}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {section.keys.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '6px 0', width: '45%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                          {row.keys.map((k, ki) => (
                            <React.Fragment key={ki}>
                              {ki > 0 && <span style={{ fontSize: 10, color: 'var(--text3)' }}>+</span>}
                              <Key label={k} />
                            </React.Fragment>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '6px 0 6px 16px', fontSize: 12, color: 'var(--text1)' }}>
                        {row.desc}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        {/* Подсказка */}
        <div style={{
          padding: '8px 20px', borderTop: '1px solid var(--border)',
          fontSize: 10, color: 'var(--text3)', flexShrink: 0,
        }}>
          Нажмите F1 или Escape чтобы закрыть
        </div>
      </div>
    </div>
  )
}
