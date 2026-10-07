# claude-pets

在 Claude Code 側邊 pane 養一隻貓或狗：餵食、摸摸、玩耍、睡覺、改名。

## 安裝

在 Claude Code 的 prompt 輸入：

```
/plugin install pets --marketplace will0715/claude-pets
```

出現 `Add marketplace?` 按 `y`，再按 Enter 選安裝範圍。裝好後馬上可用。

可在終端機的 Claude Code 或 Claude Desktop 的 Code 分頁使用。

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

## 寵物的生活

- 三個狀態每分鐘自動下降：飽 −1、樂 −2、精 −1（睡覺時精 +6）
- 飽低於 25 會自己去吃飯，精低於 20 會自己去睡 10 分鐘；關掉 Claude Code 的期間也照算（最多補 12 小時）
- 不會自己玩：樂要靠你摸摸、陪玩
- 任一狀態低於 25 會難過：坐著不動，臉變成 `T.T`，頭上冒出最缺的東西（`food?` / `play?` / `zzz?`）
- 平常會隨機走路、衝刺、坐下休息；每隻速度不同
- 玩耍時隨機挑一種玩具（貓：毛線球、逗貓棒、玩具老鼠；狗：球、飛盤、樹枝）

寵物資料存在各自電腦的 Claude Code store，最多養 4 隻。

## 開發

```
claude plugin validate .
claude plugin test .
```
