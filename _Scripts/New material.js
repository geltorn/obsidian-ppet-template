/**
 * @RunJS Новый материал
 * @RunJS {n:'NewMaterial'}
 */


// Скрипт для MetaBind в Obsidian
// Назначение: создание рабочего материала (заметки) с привязкой к проекту/человеку

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
        // --- ШАГ 1: Определение контекста по активному файлу ---
        let autoSelectedName = null;
        let autoSelectedType = null;
        let autoSelectedTag = null;
        let autoSelectedMeeting = null;

        const activeFile = workspace.getActiveFile();
        if (activeFile) {
            const cache = app.metadataCache.getFileCache(activeFile);
            if (cache?.frontmatter) {
                const { frontmatter } = cache;
                const tags = frontmatter.tags || [];
                const type = frontmatter.type;

                // Если открыт человек или проект — используем его как контекст
                if (type === "Человек" || type === "Командная встреча") {
                    autoSelectedName = activeFile.basename;
                    autoSelectedType = "Люди";
                    autoSelectedTag = tags.length > 0 ? tags[0] : null;
                } else if (type === "Проект") {
                    autoSelectedName = activeFile.basename;
                    autoSelectedType = "Проекты";
                    autoSelectedTag = tags.length > 0 ? tags[0] : null;
                }

                // Если открыта встреча — попробуем найти связанный проект/человека
                if (frontmatter.link) {
                    const linkMatch = frontmatter.link.match(/\[\[(.+?)\]\]/);
                    if (linkMatch) {
                        const linkedName = linkMatch[1];
                        const linkedFile = vault.getMarkdownFiles().find(f => f.basename === linkedName);
                        if (linkedFile) {
                            const linkedCache = app.metadataCache.getFileCache(linkedFile);
                            const linkedType = linkedCache?.frontmatter?.type;
                            if (linkedType === "Человек" || linkedType === "Командная встреча") {
                                autoSelectedName = linkedName;
                                autoSelectedType = "Люди";
                                const linkedTags = linkedCache?.frontmatter?.tags || [];
                                autoSelectedTag = linkedTags.length > 0 ? linkedTags[0] : null;
                            } else if (linkedType === "Проект") {
                                autoSelectedName = linkedName;
                                autoSelectedType = "Проекты";
                                const linkedTags = linkedCache?.frontmatter?.tags || [];
                                autoSelectedTag = linkedTags.length > 0 ? linkedTags[0] : null;
                            }
                        }
                    }
                    // Сохраняем ссылку на встречу
                    autoSelectedMeeting = activeFile.basename;
                }
            }
        }

        // --- ШАГ 2: Установка даты (всегда сегодня) ---
        const materialDate = window.moment().format("YYYY-MM-DD");

        // --- ШАГ 3: Загрузка шаблона ---
        const templatePath = "Templates/Материал.md";
        const allFiles = vault.getMarkdownFiles();
        const templateFile = allFiles.find(f => f.path === templatePath);
        if (!templateFile) {
            await new Notice(`Шаблон ${templatePath} не найден!`);
            return;
        }
        let templateContent = await vault.read(templateFile);

        // --- ШАГ 4: Выбор или подтверждение проекта/человека ---
        let selectedName = autoSelectedName;
        let selectedType = autoSelectedType;
        let mainTag = autoSelectedTag;

        if (!selectedName) {
            // Спрашиваем тип связи
            const typeChoice = await utils.suggester(
                ["Проект", "Человек"],
                item => item
            );
            if (!typeChoice) {
                await new Notice("Тип связи не выбран!");
                return;
            }
            selectedType = typeChoice === "Проект" ? "Проекты" : "Люди";

            // Выбираем из папки
            selectedName = await utils.selectFromFolder(
                allFiles,
                `${selectedType}/`,
                "Проект/человек не выбран!"
            );
            if (!selectedName) {
                return;
            }

            // Получаем тег из файла
            const selectedFile = allFiles.find(f => f.basename === selectedName);
            const fileContent = await vault.read(selectedFile);
            const tags = utils.parseFrontmatterTags(fileContent);
            mainTag = tags.length > 0 ? tags[0] : null;
        }

        // --- ШАГ 5: Ввод темы материала ---
        const defaultTopic = `Материал ${materialDate}`;
        let topicType = await utils.inputPrompt("Введите название темы материала:", "Тема", defaultTopic);
        if (topicType === null) {
            // Нажата кнопка "Отмена" — отменяем действие
            await new Notice("Действие отменено.");
            return;
        }
        if (!topicType || topicType.trim() === "") {
            topicType = defaultTopic;
        }

        // --- ШАГ 6: Опционально — выбор встречи ---
        let meetingLink = autoSelectedMeeting;
        if (!meetingLink) {
            const addMeeting = await utils.yesNoPrompt("Привязать к встрече?");
            if (addMeeting) {
                const meetingFiles = allFiles
                    .filter(file => file.path.startsWith("Встречи/"))
                    .sort((a, b) => b.basename.localeCompare(a.basename));

                const selectedMeeting = await utils.suggester(
                    meetingFiles.map(f => f.basename),
                    item => item
                );
                if (selectedMeeting) {
                    meetingLink = selectedMeeting;
                }
            }
        }

        // --- ШАГ 7: Замена шаблонных значений ---
        let content = templateContent;

        // Заменяем дату в frontmatter
        content = content.replace(/Дата: <% tp\.date\.now\(\) %>/g, `Дата: ${materialDate}`);

        // Заменяем тег в frontmatter
        if (mainTag) {
            const cleanTag = mainTag.replace('#', '');
            content = content.replace(/tags:\n/, `tags:\n  - ${cleanTag}\n`);
        }

        // Заменяем "Связано" в frontmatter
        if (selectedName) {
            content = content.replace(/Связано:\s*\n/, `Связано: "[[${selectedName}]]"\n`);
        }

        // Заменяем "Встреча" в frontmatter
        if (meetingLink) {
            content = content.replace(/Встреча:\s*\n/, `Встреча: "[[${meetingLink}]]"\n`);
        }

        // --- ШАГ 8: Генерация уникального пути ---
        const sanitizedName = selectedName.replace(/[^a-zA-Zа-яА-Я0-9_\-\s]/g, '_');
        const sanitizedTopic = topicType.replace(/[^a-zA-Zа-яА-Я0-9_\-\s]/g, '_');
        const basePath = `Материалы/${sanitizedName}-${sanitizedTopic}`;
        const finalPath = await utils.getUniqueFilePath(basePath);

        // --- ШАГ 9: Создание файла ---
        await utils.ensureFolderExists("Материалы");
        const materialNote = await vault.create(`${finalPath}.md`, content);

        // --- ШАГ 10: Добавление ссылки в встречу (если привязана) ---
        if (meetingLink) {
            const meetingFile = allFiles.find(f => f.basename === meetingLink);
            if (meetingFile) {
                let meetingContent = await vault.read(meetingFile);
                
                // Проверяем, есть ли уже секция "Материалы"
                if (!meetingContent.includes('## Материалы')) {
                    // Добавляем секцию после Action items
                    const actionItemsIndex = meetingContent.indexOf('## Action items');
                    if (actionItemsIndex !== -1) {
                        // Находим конец секции Action items
                        const nextSectionIndex = meetingContent.indexOf('##', actionItemsIndex + 15);
                        if (nextSectionIndex !== -1) {
                            const insertPosition = meetingContent.lastIndexOf('\n', nextSectionIndex);
                            meetingContent = meetingContent.slice(0, insertPosition) + 
                                '\n## Материалы\n' +
                                `- [[${materialNote.basename}]]\n` +
                                meetingContent.slice(insertPosition);
                        }
                    }
                } else {
                    // Добавляем ссылку в существующую секцию Материалы
                    const materialsSection = meetingContent.indexOf('## Материалы');
                    const nextSectionIndex = meetingContent.indexOf('##', materialsSection + 10);
                    if (nextSectionIndex !== -1) {
                        const insertPosition = meetingContent.lastIndexOf('\n', nextSectionIndex);
                        meetingContent = meetingContent.slice(0, insertPosition) + 
                            `- [[${materialNote.basename}]]\n` +
                            meetingContent.slice(insertPosition);
                    }
                }
                
                await vault.modify(meetingFile, meetingContent);
            }
        }

        // --- ШАГ 11: Открытие заметки ---
        await workspace.openLinkText(materialNote.basename, materialNote.path, true);

    } catch (error) {
        console.error("Ошибка при выполнении скрипта:", error);
        await new Notice("Произошла ошибка при создании материала.");
    }
})();
