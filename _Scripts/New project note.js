//Скрипт для Obsidian QuickAdd Plugin 
//Скрипт для создания заметки по проекту
//https://quickadd.obsidian.guide/docs/QuickAddAPI
module.exports = async (params) => {
    const { app, quickAddApi } = params;
    const { vault, workspace } = app;
    const currentDate = window.moment().format("YYYY-MM-DD");

    try { 
        // Получение списка проектов (файлов в папке Проекты)
        const allFiles = vault.getMarkdownFiles();
        const projectFiles = allFiles
            .filter(file => file.path.startsWith("Проекты/"))
            .map(file => file.basename);

        const projectNames = projectFiles;
        
        if (projectNames.length === 0) {
            new Notice("Нет доступных проектов!");
            return;
        }
        
        // Выбор проекта из списка
        const projectName = await quickAddApi.suggester(
            projectNames, 
            projectNames
        );
        
        if (!projectName) {
            new Notice("Проект не выбран!");
            return;
        }
        
        // Найти файл проекта и прочитать его для получения тега
        const projectFile = allFiles.find(file => file.basename === projectName);
        if (!projectFile) {
            new Notice("Файл проекта не найден!");
            return;
        }
        
        const projectFileContent = await vault.read(projectFile);
        
        // Извлечение тега проекта из frontmatter
        const parseTags = parseFrontmatterTags(projectFileContent);
        let projectTagCleaned = parseTags.length > 0 ? parseTags[0] : "";
        
        if (!projectTagCleaned) {
            // Если не удалось извлечь тег
            new Notice("Не удалось извлечь тег!");
            return;
        }
        
        // Запрос названия заметки
        const noteName = await quickAddApi.inputPrompt("Введи название заметки:");
        if (!noteName) {
            new Notice("Название заметки не может быть пустым!");
            return;
        }
        
        // Путь для сохранения заметки
        const folderPath = `Проекты/Заметки по проекту ${projectName}`;
        const filePath = `${folderPath}/${noteName}.md`;
        
        // Проверка, существует ли папка, и создание её при необходимости
        await ensureFolderExists(app, folderPath);
        
        // Проверка, существует ли файл
        const fileExists = await vault.adapter.exists(filePath);
        if (fileExists) {
            new Notice(`Заметка "${noteName}" уже существует!`);
            return;
        }
        
        // Содержимое заметки
        const content = `---
tags:
${projectTagCleaned}
Дата: ${currentDate}
Тема: ${noteName}
---
## ${noteName}

`;

        // Создание файла
        let noteFile = await vault.create(filePath, content);

        // Уведомление об успешном создании
        new Notice(`Заметка "${noteName}" успешно создана!`);
        // Открываем созданную заметку
        await workspace.openLinkText(noteFile.basename, noteFile.path, true);

    } catch (error) {
        console.error("Ошибка при выполнении скрипта:", error);
        await new Notice("Произошла ошибка при создании заметки по проекту.");
    }
};

function parseFrontmatterTags(content) {
    const frontmatterRegex = /^---\s*$(.*?)^---\s*$/ms;
    const match = content.match(frontmatterRegex);
    if (!match) return [];

    const frontmatter = match[1];
    const tagsLineMatch = frontmatter.match(/^\s*tags:\s*(.+)$/m);
    if (!tagsLineMatch) return [];

    const tagsLine = tagsLineMatch[1].trim();

    // Парсим массив: tags: [тег1, тег2]
    const arrayMatch = tagsLine.match(/^\[(.+)\]$/);
    if (arrayMatch) {
        return arrayMatch[1]
            .split(',')
            .map(tag => tag.trim().replace(/^["'](.*)["']$/, '$1'))
            .filter(tag => tag);
    }

    // Парсим строку: tags: тег1, тег2
    return tagsLine
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag);
}

/**
 * Убедиться, что папка существует, и создать, если нужно
 */
async function ensureFolderExists(app, folderPath) {
    if (!(await app.vault.adapter.exists(folderPath))) {
        await app.vault.adapter.mkdir(folderPath);
    }
}
