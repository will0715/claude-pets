# claude-pets

在 Claude Code 側邊 pane 養一隻貓或狗：餵食、摸摸、玩耍、睡覺、改名。

## 安裝

在 Claude Code 的 prompt 輸入：

```
/plugin install pets --marketplace will0715/claude-pets
```

出現 `Add marketplace?` 按 `y`，再按 Enter 選安裝範圍。裝好後馬上可用。

## 使用

- `/pets`：打開寵物 pane（終端機寬度不足 144 欄時，自動開啟會等到夠寬；用指令開則不受限）
- Pane 快捷鍵（點 pane 或按 `ctrl+x tab` 後）：

| 鍵 | 動作 |
|---|---|
| `f` | 餵食 |
| `t` | 摸摸 |
| `p` | 玩耍 |
| `s` | 睡覺／叫醒 |
| `n` | 換一隻 |
| `c` / `d` | 領養貓／狗 |
| `r` | 改名 |
| `x` | 送養 |

## 指令

最後面加寵物名可以指定對象，不加就作用在目前選中的那隻。

```
/pets feed [寵物名]          # 也可用 餵食
/pets pet [寵物名]           # 摸摸
/pets play [寵物名]          # 玩耍
/pets sleep [寵物名]         # 睡覺
/pets next [寵物名]          # 換一隻／選指定那隻
/pets release [寵物名]       # 送養
/pets cat [名字]             # 領養貓，可順便取名
/pets dog [名字]             # 領養狗
/pets rename <新名字> [寵物名]
```

寵物資料存在各自電腦的 Claude Code store，最多養 4 隻。

## 開發

```
claude plugin validate .
claude plugin test .
```
