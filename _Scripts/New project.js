/**
 * @RunJS Новый проект
 * @RunJS {n:'NewProject'}
 */

// Скрипт для Obsidian - запуск через MetaBind
// Назначение: автоматическое создание заметок о проектах

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

        // --- ШАГ 1: Запрос названия проекта ---
        const name = await utils.inputPrompt("Введи название проекта:");
        if (!name) {
            new Notice("Имя не может быть пустым!");
            return;
        }

        // --- ШАГ 2: Проверка существования файла ---
        const filePath = `Проекты/${name}.md`;
        const fileExists = await vault.adapter.exists(filePath);
        if (fileExists) {
            new Notice(`Заметка "${name}" уже существует!`);
            return;
        }

        // --- ШАГ 3: Запрос тега ---
        const defaultTag = `#Проект_${name.replace(/[ ]/g, '_')}`;
        let mainTag = await utils.inputPrompt("Введи tag:", '#tag', defaultTag);
        const mainTagCleaned = mainTag.replace("#", "");

        // --- ШАГ 4: Запрос ссылки ---
        const link = await utils.inputPrompt("Введи ссылку на проект:", "https://");
        const linkFormatted = link ? `[${link}](${link})` : '';

        // --- ШАГ 5: Форматирование тегов ---
        const tags = [mainTag];
        const formattedTags = tags
            .map(tag => {
                const cleanTag = tag.replace("#", "");
                return `- ${cleanTag}`;
            })
            .join("\n");

        // --- ШАГ 6: Создание содержимого заметки ---
        const content = `---
tags:
${formattedTags}
type: Проект
---
## Основная информация
- **Ссылка:** ${linkFormatted}
- **Описание:** 


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
from "Встречи" or "Проекты" or "Проекты-Материалы"
where contains(tags, "${mainTagCleaned}")
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

        // --- ШАГ 7: Создание файла ---
        await utils.ensureFolderExists("Проекты");
        const projectNote = await vault.create(filePath, content);

        // --- ШАГ 8: Уведомление и открытие ---
        new Notice(`Заметка "${name}" успешно создана!`);
        await workspace.openLinkText(projectNote.basename, projectNote.path, true);

    } catch (error) {
        console.error("Ошибка при выполнении скрипта:", error);
        new Notice("Ошибка: " + error.message, 8000);
    }
})();
