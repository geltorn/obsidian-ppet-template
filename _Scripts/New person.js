/**
 * @RunJS Новый человек
 * @RunJS {n:'NewPerson'}
 */

// Скрипт для Obsidian - запуск через MetaBind
// Назначение: автоматическое создание заметок о людях

// ─── ЗАГРУЗКА УТИЛИТ ────────────────────────────────────────────
// Код утилит загружается из файла MetaBindUtils.js через eval
const utilsContent = await window.app.vault.adapter.read("_Scripts/MetaBindUtils.js");
eval(utilsContent);

(async () => {
    const app = window.app;
    if (!app) {
        new Notice("Ошибка: не найден объект app");
        return;
    }

    new Notice("Скрипт запущен...");

    try {
        // Загружаем утилиты
        const utils = await loadMetaBindUtils();
        const { vault, workspace } = app;
        const allFiles = vault.getMarkdownFiles();

        // --- ШАГ 1: Запрос имени человека ---
        const name = await utils.inputPrompt("Введи имя человека:");
        if (!name) {
            new Notice("Имя не может быть пустым!");
            return;
        }

        // --- ШАГ 2: Проверка существования файла ---
        const filePath = `Люди/${name}.md`;
        const fileExists = await vault.adapter.exists(filePath);
        if (fileExists) {
            new Notice(`Заметка о человеке "${name}" уже существует!`);
            return;
        }

        // --- ШАГ 3: Запрос тега ---
        const defaultTag = `#1-1_${name.replace(/[ ]/g, '_')}`;
        let mainTag = await utils.inputPrompt("Введи tag:", '#tag', defaultTag);

        // --- ШАГ 4: Запрос логина ---
        let login = await utils.inputPrompt("Введи логин:");
        login = login.replace(/[^a-zA-Z0-9._-]/g, '');
        const email = await utils.inputPrompt("Введи email:");

        // --- ШАГ 5: Запрос ссылки на профиль ---
        const link = await utils.inputPrompt("Введи ссылку на профиль:", "https://example.com/", "https://example.com/");

        // --- ШАГ 6: Выбор тегов команды ---
        const existingTags = ["#команда", "#бизнес", "#важный", "#знакомый"];
        const selectedTags = await utils.checkboxPrompt(existingTags);
        const tags = [mainTag, ...(selectedTags || [])].join(" ");
        const formattedTags = tags
            .split(" ")
            .map(tag => {
                const cleanTag = tag.replace("#", "");
                return `- ${cleanTag}`;
            })
            .join("\n");

        // --- ШАГ 7: Создание содержимого заметки ---
        const content = `---
tags:
${formattedTags}
type: Человек
---
## Основная информация
- **Логин:** ${login}
- [**Написать в мессенджер**](https://example.com/messages/@${login})
- **Email:** ${email}
- **Ссылка на профиль:** [${link}](${link})

## Встречи

\`\`\`meta-bind-button
style: primary
label: Завести встречу
icon: plus
action:
  type: js
  file: "_Scripts/New meeting.js"
\`\`\`
\`\`\`dataview
table dateformat(Дата, "dd.MM.yyyy") as "Дата встречи"
from "Встречи"
where contains(tags, "${mainTag.replace('#', '')}")
sort Дата desc
\`\`\`

## Задачи
\`\`\`tasks
path does not include Templates/
tag includes ${mainTag}
\`\`\`

## Рабочие заметки

\`\`\`meta-bind-button
style: primary
label: Завести материал
icon: plus
action:
  type: js
  file: "_Scripts/New material.js"
\`\`\`
\`\`\`dataview
table dateformat(Дата, "dd.MM.yyyy") as "Дата", Тема
from "Материалы"
where contains(Связано, this.file.link)
sort Дата desc
\`\`\`

`;

        // --- ШАГ 8: Создание файла ---
        await utils.ensureFolderExists("Люди");
        const personNote = await vault.create(filePath, content);

        // --- ШАГ 9: Уведомление и открытие ---
        new Notice(`Заметка о человеке "${name}" успешно создана!`);
        await workspace.openLinkText(personNote.basename, personNote.path, true);

    } catch (error) {
        console.error("Ошибка при выполнении скрипта:", error);
        new Notice("Ошибка: " + error.message, 8000);
    }
})();
