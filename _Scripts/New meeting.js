/**
 * @RunJS Новая встреча
 * @RunJS {n:'NewMeeting'}
 */

// Скрипт для Obsidian - запуск через MetaBind
// Назначение: автоматическое создание заметок о встречах (1-1, по проекту, обычная)
// Поддерживает автоматический выбор типа встречи по активному файлу и избегает дублирования имён

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

        // --- ШАГ 0: Определение типа встречи по активному файлу ---
        let autoSelectedMeetingType = null;
        let autoSelectedPerson = null;
        let autoSelectedProject = null;
        let mainTag = null;

        const activeFile = workspace.getActiveFile();
        if (activeFile) {
            const cache = app.metadataCache.getFileCache(activeFile);
            if (cache?.frontmatter) {
                const { frontmatter } = cache;
                const tags = frontmatter.tags || [];
                const type = frontmatter.type;

                if (type === "Человек" || type === "Командная встреча") {
                    mainTag = tags.length > 0 ? tags[0] : null;
                    autoSelectedMeetingType = "Встреча 1-1";
                    autoSelectedPerson = activeFile.basename;
                } else if (type === "Проект") {
                    mainTag = tags.length > 0 ? tags[0] : null;
                    autoSelectedMeetingType = "Встреча по проекту";
                    autoSelectedProject = activeFile.basename;
                }
            }
        }

        // --- ШАГ 1: Выбор даты встречи ---
        const currentDate = window.moment().format("YYYY-MM-DD");
        const dateChoice = await utils.yesNoPrompt("Встреча сегодня?");
        let meetingDate = dateChoice
            ? currentDate
            : await utils.inputPrompt("Введите дату встречи (YYYY-MM-DD):", "YYYY-MM-DD", currentDate);

        if (!meetingDate || !window.moment(meetingDate, "YYYY-MM-DD", true).isValid()) {
            new Notice("Некорректный формат даты!");
            return;
        }

        const isNotToday = !window.moment(meetingDate).isSame(currentDate, "day");

        // --- ШАГ 2: Загрузка шаблонов ---
        const templates = {
            daily:      "Templates/Ежедневная заметка.md",
            meeting1to1: "Templates/Встреча 1-1.md",
            meeting:    "Templates/Встреча.md",
            project:    "Templates/Встреча по проекту.md"
        };

        const loadedTemplates = await utils.loadTemplates(templates);

        // --- ШАГ 3: Создание или обновление ежедневной заметки ---
        const dailyNotePath = `Дневник/${ meetingDate }.md`;
        let dailyNote = allFiles.find(f => f.path === dailyNotePath);

        if (!dailyNote) {
            await utils.ensureFolderExists("Дневник");
            let dailyContent = loadedTemplates.daily;
            if (isNotToday) {
                dailyContent = utils.replaceTemplateDateWithMeetingDate(dailyContent, meetingDate);
            }
            dailyNote = await vault.create(dailyNotePath, dailyContent);
        } else if (isNotToday) {
            let content = await vault.read(dailyNote);
            content = utils.replaceTemplateDateWithMeetingDate(content, meetingDate);
            await vault.modify(dailyNote, content);
        }

        // --- ШАГ 4: Выбор типа встречи ---
        const meetingTypes = ["Встреча 1-1", "Обычная встреча", "Встреча по проекту"];
        const selectedMeetingType = autoSelectedMeetingType
            || await utils.suggester(meetingTypes, item => item);

        if (!selectedMeetingType) {
            new Notice("Тип встречи не выбран!");
            return;
        }

        // --- ШАГ 5: Создание заметки о встрече ---
        await utils.ensureFolderExists("Встречи");

        let selectedName = null;
        let baseName = "Встреча";
        let templateContent = loadedTemplates.meeting;
        let linkKey = null;

        if (selectedMeetingType === "Встреча 1-1") {
            selectedName = autoSelectedPerson
                || await utils.selectFromFolder(allFiles, "Люди/", "Человек не выбран!");
            if (!selectedName) return;

            templateContent = loadedTemplates.meeting1to1;
            baseName = selectedName;
            linkKey = "link";

            if (!autoSelectedPerson) {
                const sourceFile = allFiles.find(f => f.basename === selectedName);
                if (sourceFile) {
                    const tags = utils.parseFrontmatterTags(sourceFile);
                    mainTag = tags.length > 0 ? tags[0] : null;
                }
            }

        } else if (selectedMeetingType === "Встреча по проекту") {
            selectedName = autoSelectedProject
                || await utils.selectFromFolder(allFiles, "Проекты/", "Проект не выбран!");
            if (!selectedName) return;

            templateContent = loadedTemplates.project;
            baseName = `${ selectedName } -Встреча`;
            linkKey = "link";

            if (!autoSelectedProject) {
                const sourceFile = allFiles.find(f => f.basename === selectedName);
                if (sourceFile) {
                    const tags = utils.parseFrontmatterTags(sourceFile);
                    mainTag = tags.length > 0 ? tags[0] : null;
                }
            }
        }

        // Заменяем шаблонную дату если встреча не сегодня
        let content = templateContent;
        if (isNotToday) {
            content = utils.replaceTemplateDateWithMeetingDate(content, meetingDate);
        }

        // Генерируем уникальный путь
        const basePath = `Встречи/${ meetingDate }-${ baseName }`;
        const finalPath = await utils.getUniqueFilePath(basePath);

        // Создаём файл встречи
        const meetingNote = await vault.create(`${ finalPath }.md`, content);

        // Добавляем тег если есть
        if (mainTag) {
            await utils.addTagToFrontmatter(meetingNote, mainTag);
        }

        // Добавляем ссылку если есть
        if (linkKey && selectedName) {
            await utils.setFrontmatterField(meetingNote, linkKey, `[[${ selectedName }]]`);
        }

        // --- ШАГ 6: Открытие созданной заметки ---
        await workspace.openLinkText(meetingNote.basename, meetingNote.path, true);
        new Notice(`Встреча создана: ${ meetingNote.basename } `);

    } catch (error) {
        console.error("Ошибка при выполнении скрипта:", error);
        new Notice("Ошибка: " + error.message, 8000);
    }
})();
