//Скрипт для Obsidian QuickAdd Plugin 
//Скрипт для быстрого добавления задачи с тегом из текущей заметки
//https://quickadd.obsidian.guide/docs/QuickAddAPI
module.exports = async (params) => {
    const { app, quickAddApi } = params;
    const { vault, workspace } = app;

    try {
        // Получаем активную заметку
        const activeFile = workspace.getActiveFile();
        if (!activeFile) {
            await new Notice("Нет активной заметки!");
            return;
        }

        // Читаем содержимое активной заметки
        const fileContent = await vault.read(activeFile);
        
        // Извлекаем теги из YAML заголовка
        const tags = parseFrontmatterTags(activeFile);
        const primaryTag = tags.length > 0 ? tags[0] : null;

        // Получаем все теги из кэша метаданных
        const allTags = Object.keys(app.metadataCache.getTags()).slice(0, 16);;
        
        // Подготавливаем список тегов для выбора
        // По умолчанию выбираем: главный тег, "Мои_задачи"
        const defaultSelectedTags = new Set();
        defaultSelectedTags.add("Мои_задачи");
        if (primaryTag) {
            defaultSelectedTags.add(primaryTag);
        }
        
        // Создаем список всех доступных тегов без символов #
        // Исключаем "Мои_задачи" из allTags чтобы избежать дубликатов
        const availableTags = Array.from(new Set([
            ...(primaryTag ? [primaryTag] : []),
            "Мои_задачи",
            ...allTags.map(tag => tag.substring(1)).filter(tag => tag !== "Мои_задачи")
        ]));

        // Запрашиваем текст задачи у пользователя
        const taskText = await quickAddApi.inputPrompt(
            "Введите текст задачи:", 
            "Текст задачи"
        );
        
        if (!taskText) {
            await new Notice("Текст задачи не может быть пустым!");
            return;
        }

        // Запрашиваем выбор тегов у пользователя
        const selectedTags = await quickAddApi.checkboxPrompt(
            availableTags,
            Array.from(defaultSelectedTags)
        );
        
        // Если пользователь отменил выбор тегов, используем теги по умолчанию
        const finalSelectedTags = selectedTags || Array.from(defaultSelectedTags);

        // Вычисляем дату через неделю
        const defaultDate = new Date();
        defaultDate.setDate(defaultDate.getDate() + 7);
        const defaultDateString = defaultDate.toISOString().split('T')[0];

        // Запрашиваем дату исполнения у пользователя
        const dateInput = await quickAddApi.inputPrompt(
            "Введите дату исполнения задачи (в формате ГГГГ-ММ-ДД):", 
            "Дата исполнения",
            defaultDateString
        );
        
        // Если пользователь ввел дату, используем её, иначе оставляем поле пустым
        let datePart = '';
        if (dateInput && dateInput.trim() !== '') {
            // Проверяем формат даты (упрощенная проверка)
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (dateRegex.test(dateInput.trim())) {
                datePart = ` 📅 ${dateInput.trim()}`;
            } else {
                await new Notice("Неверный формат даты. Дата не будет добавлена.");
            }
        }

        // Формируем строку задачи с датой и тегами
        const tagsPart = finalSelectedTags && finalSelectedTags.length > 0 
            ? " " + finalSelectedTags.map(tag => `#${tag}`).join(" ") 
            : "";
        const taskString = `- [ ] ${taskText}${datePart}${tagsPart}`;

        // Вставляем задачу в текущую позицию курсора
        const editor = app.workspace.activeLeaf.view.editor;
        editor.replaceSelection(taskString);

        await new Notice(`Задача добавлена: ${taskText}`);

    } catch (error) {
        console.error("Ошибка при выполнении скрипта:", error);
        await new Notice("Произошла ошибка при добавлении задачи.");
    }
};

function parseFrontmatterTags(activeFile) {
    let frontmatter = app.metadataCache.getFileCache(activeFile).frontmatter;
    return frontmatter.tags;
}