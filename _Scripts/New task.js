// Скрипт для MetaBind в Obsidian
// Назначение: создание задачи с тегом из текущей заметки

/**
 * @RunJS Новая задача
 * @RunJS {n:'NewTask'}
 */

(async () => {
    const app = window.app;
    if (!app) {
        new Notice("Obsidian app не найден");
        return;
    }

    const { vault, workspace } = app;

    // Загрузка утилит
    const utilsContent = await vault.adapter.read("_Scripts/MetaBindUtils.js");
    eval(utilsContent);
    const utils = await loadMetaBindUtils();

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
        const tags = utils.parseFrontmatterTags(fileContent);
        const primaryTag = tags.length > 0 ? tags[0] : null;

        // Запрашиваем текст задачи у пользователя
        const taskText = await utils.inputPrompt(
            "Введите текст задачи:",
            "Текст задачи"
        );

        if (!taskText) {
            await new Notice("Текст задачи не может быть пустым!");
            return;
        }

        // Вычисляем дату через неделю
        const defaultDate = window.moment().add(7, 'days').format("YYYY-MM-DD");

        // Запрашиваем дату исполнения у пользователя
        const dateInput = await utils.inputPrompt(
            "Введите дату исполнения задачи (в формате ГГГГ-ММ-ДД):",
            "Дата исполнения",
            defaultDate
        );

        // Всегда добавляем основной тег, если он существует
        const selectedTags = [];
        if (primaryTag) {
            selectedTags.push(primaryTag);
        }

        // Запрашиваем у пользователя, нужно ли добавлять тег "Мои_задачи"
        const addMyTasksTag = await utils.yesNoPrompt("Добавить тег #Мои_задачи?");

        if (addMyTasksTag) {
            selectedTags.push("Мои_задачи");
        }

        // --- ВЫБОР ЧЕЛОВЕКА (опционально) ---
        // Запрашиваем у пользователя, нужно ли добавить тег человека
        const addPersonTag = await utils.yesNoPrompt("Добавить тег человека?", false);
        
        if (addPersonTag) {
            // Загружаем список людей из папки "Люди"
            const allFiles = vault.getMarkdownFiles();
            const peopleFiles = allFiles
                .filter(file => file.path.startsWith("Люди/"))
                .sort((a, b) => a.basename.localeCompare(b.basename));

            // Предлагаем выбрать человека из списка
            const selectedPerson = await utils.suggester(
                peopleFiles.map(f => f.basename),
                item => item
            );
            if (selectedPerson) {
                // Извлекаем тег из файла человека
                const selectedFile = allFiles.find(f => f.basename === selectedPerson);
                if (!selectedFile) {
                    console.error("[ERROR] Файл не найден для:", selectedPerson);
                } else {
                    const personContent = await vault.read(selectedFile);
                    const personTags = utils.parseFrontmatterTags(personContent);
                    const personTag = personTags.length > 0 ? personTags[0] : selectedPerson;
                    selectedTags.push(personTag);
                }
            }
        }

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
        const tagsPart = selectedTags && selectedTags.length > 0
            ? " " + selectedTags.map(tag => `#${tag}`).join(" ")
            : "";
        const taskString = `- [ ] ${taskText}${datePart}${tagsPart}`;

        // Вставляем задачу в текущую позицию курсора
        const editor = app.workspace.activeLeaf.view.editor;
        editor.replaceSelection(taskString);

        console.log(`Задача добавлена: ${taskText}`);
        await new Notice(`Задача добавлена: ${taskText}`);

    } catch (error) {
        console.error("Ошибка при выполнении скрипта:", error);
        await new Notice("Произошла ошибка при добавлении задачи.");
    }
})();
