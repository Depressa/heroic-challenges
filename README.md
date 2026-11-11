# Heroic Challenges for Foundry VTT

## English

Heroic Challenges brings the Heroic Challenges card game to your table, inside Foundry VTT. Challenges and rewards are dealt, held, claimed and played from the module's window and chat cards, with the GM making the final calls.

### How the game works in the module

- **Decks.** Two decks, challenges and rewards, are built from the sets you enable: Core Set (always on), Power and Prowess, Vice and Virtue and Bonus Challenges.
- **Hands.** Each player holds challenges (one by default, up to three). The window shows the hand, and each card shows both of its options.
- **Claims.** When a challenge is done, the player claims one option, or both in epic difficulty. The GM accepts or declines the claim.
- **Rewards.** An accepted claim draws a reward card with two results. The player or the GM chooses one, and can reroll or decline.
- **Reward items.** Rewards that help in play (rerolls, automatic successes, extra damage and similar) become one-use items on the character sheet. Story rewards are left for the GM to play out, and the chat says so.
- **Variants.** A challenge for the whole group or a session theme on the table, swapping, transferring or discarding cards, hidden hands, and letting players make decisions themselves.
- **Idea cards.** The GM can draw a random challenge or reward privately, as inspiration, without dealing it.

### Window and commands

- Open the window with the dragon button in the token controls, with `/hc` (or `/вызовы`) in the chat, or from the module settings.
- The window shows the hand, the decks, and the discard. The GM also sees every player's hand and the table, and has the controls to deal, give rewards and reset the decks.

### Sets

| Set | Challenges | Rewards | Enabled |
|---|---|---|---|
| Core Set | 50 | 50 | always |
| Power and Prowess | 25 | 25 | in the settings |
| Vice and Virtue | 25 | 25 | in the settings |
| Bonus Challenges | 25 | none | in the settings (rewards come from the enabled reward decks) |

### Requirements

- Foundry VTT 14
- dnd5e system 5.3.0 or later
- No other modules are required.

### Installation

**By manifest URL.** In Foundry, open Add-on Modules → Install Module and paste the manifest URL:

```
https://raw.githubusercontent.com/Depressa/heroic-challenges/main/heroic-challenges/module.json
```

**From a release.** Download `heroic-challenges.zip` from the Releases page and unzip it into the `Data/modules` folder of your Foundry data. The archive already contains the `heroic-challenges` folder.

After installing or updating the module, restart Foundry completely. Reloading the world is not enough. Then enable the module in Manage Modules. The decks are created the first time the world starts with the GM online.

### Settings

All settings are in Settings → Configure Settings → Module Settings → Heroic Challenges. Only the GM can change them.

- **Additional sets:** Power and Prowess, Vice and Virtue, Bonus Challenges.
- **Dealing:** how challenges are dealt (each player, one for the whole group, or a session theme), the hand size, who receives challenges, and who can see a hand.
- **Rules:** epic difficulty and whether players may swap their challenges.
- **Who decides:** whether players take part in decisions, whether they may claim their challenges, and whether claims are confirmed by the GM or accepted at once.
- **Rewards:** which rewards become items on the character sheet.

A full reference with default values is in [SETTINGS.md](SETTINGS.md).

### Languages

The interface and the card texts are available in English and Russian. The language follows Foundry's language setting.

### Limitations

- The module does not check whether a challenge was completed. The GM decides.
- It does not roll checks, saves or rerolls for the player, and does not change attacks, conditions, spell slots, hit points or experience. A reward such as "reroll a failed check" is used by the player through the item, and the GM allows the reroll.
- Hidden hands are hidden in the interface only. The GM can still read the world data.
- The module keeps no journal or statistics.

### License

The card texts belong to their rights holder. The module is for use with the Heroic Challenges card game. Do not publish or distribute the card texts without the permission of the rights holder.

## Русский

Heroic Challenges ведёт за столом карточную игру Heroic Challenges прямо в Foundry VTT. Вызовы и награды раздаются, держатся на руке, заявляются и разыгрываются через окно модуля и карточки в чате, а окончательные решения принимает Мастер.

### Как игра работает в модуле

- **Колоды.** Две колоды, вызовов и наград, собираются из включённых наборов: Core Set (всегда), Power and Prowess, Vice and Virtue и Bonus Challenges.
- **Руки.** Каждый игрок держит вызовы (по умолчанию один, до трёх). В окне видна рука, у каждой карты оба варианта.
- **Заявки.** Когда вызов выполнен, игрок заявляет один вариант или оба при эпической сложности. Мастер принимает или отклоняет заявку.
- **Награды.** Принятая заявка даёт карту награды с двумя результатами. Выбирает один из них игрок или Мастер; можно взять другую награду или отказаться.
- **Предметы-награды.** Награды, которые помогают в игре (перебросы, автоуспехи, дополнительный урон и подобное), становятся одноразовыми предметами на листе персонажа. Сюжетные награды Мастер разыгрывает сам, в чате это указано.
- **Варианты игры.** Общий вызов для группы или тема сессии на столе; замена, передача и сброс карт; скрытая рука; решения, которые принимают сами игроки.
- **Карты-идеи.** Мастер может тайно вытянуть случайный вызов или награду как вдохновение, не раздавая её.

### Окно и команды

- Окно открывается кнопкой с драконом в инструментах токенов, командой `/hc` (или `/вызовы`) в чате и из настроек модуля.
- В окне видны рука, колоды и сброс. Мастер видит руки всех игроков и общий вызов, а также кнопки раздачи, выдачи наград и сброса колод.

### Наборы

| Набор | Вызовы | Награды | Включение |
|---|---|---|---|
| Основной набор (Core Set) | 50 | 50 | всегда |
| Мощь и доблесть (Power and Prowess) | 25 | 25 | в настройках |
| Порок и добродетель (Vice and Virtue) | 25 | 25 | в настройках |
| Бонусные вызовы | 25 | нет | в настройках (награды берутся из подключённых колод наград) |

### Требования

- Foundry VTT 14
- Система dnd5e 5.3.0 или новее
- Других модулей не нужно.

### Установка

**По ссылке на манифест.** В Foundry откройте Add-on Modules → Install Module и вставьте ссылку на манифест:

```
https://raw.githubusercontent.com/Depressa/heroic-challenges/main/heroic-challenges/module.json
```

**Из релиза.** Скачайте `heroic-challenges.zip` со страницы Releases и распакуйте в папку `Data/modules` вашей установки Foundry. В архиве уже есть папка `heroic-challenges`.

После установки или обновления модуля полностью перезапустите Foundry: перезагрузки мира недостаточно. Затем включите модуль в Manage Modules. Колоды создаются при первом запуске мира, когда Мастер в сети.

### Настройки

Все настройки лежат в Settings → Configure Settings → Module Settings → Heroic Challenges. Менять их может только Мастер.

- **Дополнительные наборы:** Мощь и доблесть, Порок и добродетель, Бонусные вызовы.
- **Раздача вызовов:** как раздаются вызовы (каждому игроку, один на всю группу или тема сессии), размер руки, кому раздаются вызовы и кто видит руку.
- **Правила:** эпическая сложность и можно ли игрокам менять свои вызовы.
- **Кто решает:** участвуют ли игроки в решениях, могут ли заявлять свои вызовы, подтверждает ли Мастер заявки или они принимаются сразу.
- **Награды:** какие награды становятся предметами на листе персонажа.

Полный справочник со значениями по умолчанию: [SETTINGS.md](SETTINGS.md).

### Языки

Интерфейс и тексты карт есть на английском и русском. Язык выбирается настройками Foundry.

### Ограничения

- Модуль не проверяет, выполнен ли вызов. Решает Мастер.
- Модуль не бросает кубики и не меняет броски, состояния, ячейки заклинаний, хиты и опыт. Награда вроде «перебросьте проверку» применяется игроком через предмет, а переброс разрешает Мастер.
- Скрытая рука скрыта только в интерфейсе: Мастер по-прежнему может прочитать данные мира.
- Журнал и статистика не ведутся.

### Лицензия

Тексты карт принадлежат их правообладателю. Модуль предназначен для игры в карточную игру Heroic Challenges. Публиковать и распространять тексты карт без разрешения правообладателя нельзя.
