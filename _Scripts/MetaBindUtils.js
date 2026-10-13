// MetaBindUtils.js - Переиспользуемые утилиты для MetaBind скриптов в Obsidian
// Использование: const utils = await loadMetaBindUtils(app);

async function loadMetaBindUtils() {
    const app = window.app;
    if (!app) {
        throw new Error("Obsidian app не найден");
    }

    const { vault } = app;
    const obsidian = require("obsidian");
    const { Modal, FuzzySuggestModal } = obsidian;

    // ─── ДИАЛОГИ ─────────────────────────────────────────────────

    /**
     * Показать input диалог
     * @param {string} title - Заголовок окна
     * @param {string} placeholder - Текст подсказки
     * @param {string} defaultValue - Значение по умолчанию
     * @returns {Promise<string|null>}
     */
    function inputPrompt(title, placeholder = "", defaultValue = "") {
        return new Promise((resolve) => {
            const modal = new Modal(app);
            modal.titleEl.setText(title);
            
            const input = modal.contentEl.createEl("input", {
                type: "text",
                placeholder: placeholder,
                value: defaultValue,
            });
            input.style.width = "100%";
            input.style.marginBottom = "10px";
            
            const buttonContainer = modal.contentEl.createDiv({ cls: "modal-button-container" });
            buttonContainer.style.display = "flex";
            buttonContainer.style.gap = "8px";
            buttonContainer.style.justifyContent = "flex-end";
            
            const confirmBtn = buttonContainer.createEl("button", { text: "OK" });
            confirmBtn.onclick = () => {
                resolve(input.value);
                modal.close();
            };
            
            const cancelBtn = buttonContainer.createEl("button", { text: "Отмена" });
            cancelBtn.onclick = () => {
                resolve(null);
                modal.close();
            };
            
            input.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    const value = input.value;
                    resolve(value);
                    modal.close();
                } else if (e.key === "Escape") {
                    e.preventDefault();
                    resolve(null);
                    modal.close();
                }
                // Для всех остальных клавиш (буквы, цифры) — ничего не делаем,
                // ввод продолжается нативно через input
            });
            
            modal.open();
            input.focus();
        });
    }

    /**
     * Показать yes/no диалог
     * @param {string} title - Заголовок вопроса
     * @param {boolean} defaultYes - true = выделена кнопка "Да", false = выделена кнопка "Нет" (по умолчанию true)
     * @returns {Promise<boolean>}
     */
    function yesNoPrompt(title, defaultYes = true) {
        return new Promise((resolve) => {
            const modal = new Modal(app);
            modal.titleEl.setText(title);
            
            const buttonContainer = modal.contentEl.createDiv({ cls: "modal-button-container" });
            buttonContainer.style.display = "flex";
            buttonContainer.style.gap = "8px";
            buttonContainer.style.justifyContent = "center";
            
            const yesBtn = buttonContainer.createEl("button", { text: "Да" });
            yesBtn.onclick = () => {
                resolve(true);
                modal.close();
            };
            
            const noBtn = buttonContainer.createEl("button", { text: "Нет" });
            noBtn.onclick = () => {
                resolve(false);
                modal.close();
            };
            
            // Обработка клавиш
            modal.contentEl.addEventListener("keydown", (e) => {
                if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                    // Переключение фокуса стрелками
                    if (document.activeElement === yesBtn) {
                        noBtn.focus();
                    } else {
                        yesBtn.focus();
                    }
                }
                if (e.key === "Escape") {
                    resolve(false);
                    modal.close();
                }
            });
            
            modal.open();
            
            // Фокус на нужной кнопке после открытия (с задержкой)
            setTimeout(() => {
                if (defaultYes) {
                    yesBtn.focus();
                } else {
                    noBtn.focus();
                }
            }, 50);
        });
    }

    /**
     * Показать suggester с выбором из списка
     * @param {string[]|Object[]} items - Массив элементов для выбора
     * @param {Function} displayFunc - Функция для отображения элемента (item => string)
     * @returns {Promise<any|null>}
     */
    function suggester(items, displayFunc) {
        return new Promise((resolve) => {
            let selectedIndex = 0;
            let selectedValue = null;
            const buttons = [];
            
            const modal = new Modal(app);
            modal.titleEl.setText("Выберите элемент");
            
            const container = modal.contentEl.createDiv();
            container.style.maxHeight = "60vh";
            container.style.minHeight = "200px";
            container.style.overflowY = "auto";
            container.setAttribute("tabindex", "0");
            container.style.width = "100%";
            
            // Функция подсветки вынесена наружу
            const updateHighlight = () => {
                buttons.forEach((btn, idx) => {
                    if (idx === selectedIndex) {
                        btn.style.backgroundColor = "var(--background-modifier-hover)";
                        btn.style.outline = "2px solid var(--interactive-accent)";
                        btn.style.outlineOffset = "-2px";
                    } else {
                        btn.style.backgroundColor = "";
                        btn.style.outline = "";
                    }
                });
            };
            
            items.forEach((item, index) => {
                const displayText = displayFunc ? displayFunc(item) : String(item);
                const button = container.createEl("div", { 
                    text: displayText,
                    cls: "suggestion-item"
                });
                button.style.padding = "8px 12px";
                button.style.cursor = "pointer";
                button.style.borderRadius = "4px";
                button.style.marginBottom = "4px";
                
                buttons.push(button);
                
                button.addEventListener("mouseenter", () => {
                    selectedIndex = index;
                    selectedValue = item;
                    updateHighlight();
                });
                
                button.addEventListener("click", () => {
                    selectedValue = item;
                    modal.close();
                });
            });
            
            // Обработка клавиш
            container.addEventListener("keydown", (e) => {
                if (e.key === "ArrowDown") {
                    e.preventDefault();
                    selectedIndex = Math.min(selectedIndex + 1, buttons.length - 1);
                    selectedValue = items[selectedIndex];
                    buttons[selectedIndex]?.scrollIntoView({ block: "nearest" });
                    updateHighlight();
                } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    selectedIndex = Math.max(selectedIndex - 1, 0);
                    selectedValue = items[selectedIndex];
                    buttons[selectedIndex]?.scrollIntoView({ block: "nearest" });
                    updateHighlight();
                } else if (e.key === "Enter") {
                    e.preventDefault();
                    if (selectedIndex >= 0 && buttons[selectedIndex]) {
                        selectedValue = items[selectedIndex];
                        modal.close();
                    }
                } else if (e.key === "Escape") {
                    e.preventDefault();
                    selectedValue = null;
                    modal.close();
                }
            });
            
            modal.onClose = () => {
                resolve(selectedValue);
            };
            
            modal.open();
            
            // Фокус на контейнере после открытия
            setTimeout(() => {
                container.focus();
                if (buttons.length > 0) {
                    selectedIndex = 0;
                    selectedValue = items[0];
                    updateHighlight();
                }
            }, 50);
        });
    }

    /**
     * Показать чекбоксы для выбора нескольких элементов
     * @param {string[]} items - Массив элементов для выбора
     * @returns {Promise<string[]>}
     */
    function checkboxPrompt(items) {
        return new Promise((resolve) => {
            const selectedItems = new Set();
            const checkboxes = [];
            
            const modal = new Modal(app);
            modal.titleEl.setText("Выберите элементы");
            
            const container = modal.contentEl.createDiv();
            container.style.maxHeight = "60vh";
            container.style.minHeight = "200px";
            container.style.overflowY = "auto";
            
            items.forEach((item, index) => {
                const checkboxContainer = container.createDiv();
                checkboxContainer.style.display = "flex";
                checkboxContainer.style.alignItems = "center";
                checkboxContainer.style.gap = "8px";
                checkboxContainer.style.padding = "8px 0";
                
                const checkbox = checkboxContainer.createEl("input", {
                    type: "checkbox",
                    id: `checkbox-${index}`
                });
                
                const label = checkboxContainer.createEl("label", {
                    text: item,
                    attr: { for: `checkbox-${index}` }
                });
                label.style.cursor = "pointer";
                
                checkbox.addEventListener("change", () => {
                    if (checkbox.checked) {
                        selectedItems.add(item);
                    } else {
                        selectedItems.delete(item);
                    }
                });
                
                checkboxes.push(checkbox);
            });
            
            const buttonContainer = modal.contentEl.createDiv({ cls: "modal-button-container" });
            buttonContainer.style.display = "flex";
            buttonContainer.style.gap = "8px";
            buttonContainer.style.justifyContent = "flex-end";
            buttonContainer.style.marginTop = "16px";
            
            const confirmBtn = buttonContainer.createEl("button", { text: "OK" });
            confirmBtn.onclick = () => {
                resolve(Array.from(selectedItems));
                modal.close();
            };
            
            const cancelBtn = buttonContainer.createEl("button", { text: "Отмена" });
            cancelBtn.onclick = () => {
                resolve([]);
                modal.close();
            };
            
            modal.open();
        });
    }

    // ─── РАБОТА С ФАЙЛАМИ ────────────────────────────────────────

    /**
     * Выбрать файл из папки
     * @param {TFile[]} allFiles - Все файлы хранилища
     * @param {string} folderPrefix - Префикс пути папки (например, "Люди/")
     * @param {string} errorMessage - Сообщение об ошибке если ничего не выбрано
     * @returns {Promise<string|null>}
     */
    async function selectFromFolder(allFiles, folderPrefix, errorMessage) {
        const items = allFiles
            .filter(file => file.path.startsWith(folderPrefix))
            .map(file => file.basename);
        const selected = await suggester(items, item => item);
        if (!selected) new Notice(errorMessage);
        return selected;
    }

    /**
     * Создать папку если не существует
     * @param {string} folderName - Имя папки
     */
    async function ensureFolderExists(folderName) {
        if (!(await vault.adapter.exists(folderName))) {
            await vault.adapter.mkdir(folderName);
        }
    }

    /**
     * Получить уникальный путь для файла
     * @param {string} baseMeetingPath - Базовый путь
     * @returns {Promise<string>}
     */
    async function getUniqueFilePath(basePath) {
        let counter = 1;
        let path = basePath;
        const allFiles = vault.getMarkdownFiles();
        while (allFiles.some(file => file.path === `${ path }.md`)) {
            path = `${ basePath } (${ counter })`;
            counter++;
        }
        return path;
    }

    // ─── РАБОТА С FRONTMATTER ────────────────────────────────────

    /**
     * Получить теги из frontmatter файла
     * @param {TFile|string} fileOrContent - Файл или содержимое файла
     * @returns {string[]}
     */
    function parseFrontmatterTags(fileOrContent) {
        // Если передан файл (TFile)
        if (fileOrContent.path) {
            const cache = app.metadataCache.getFileCache(fileOrContent);
            return cache?.frontmatter?.tags || [];
        }
        
        // Если передано содержимое файла (string)
        const content = fileOrContent;
        const frontmatterRegex = /^---\s*$(.*?)^---\s*$/ms;
        const match = content.match(frontmatterRegex);
        if (!match) return [];

        const frontmatter = match[1];
        const tagsLineMatch = frontmatter.match(/^\s*tags:\s*(.+)$/m);
        if (!tagsLineMatch) return [];

        const tagsLine = tagsLineMatch[1].trim();

        const arrayMatch = tagsLine.match(/^\[(.+)\]$/);
        if (arrayMatch) {
            return arrayMatch[1]
                .split(',')
                .map(tag => tag.trim().replace(/^["'](.*)["']$/, '$1'))
                .filter(tag => tag);
        }

        const lines = frontmatter.split('\n');
        const tags = [];
        let inTagsSection = false;

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('tags:')) {
                inTagsSection = true;
                const inlineTagMatch = trimmedLine.match(/^tags:\s*(.+)$/);
                if (inlineTagMatch && !inlineTagMatch[1].startsWith('[')) {
                    const inlineTag = inlineTagMatch[1].trim();
                    if (inlineTag && !inlineTag.startsWith('-')) {
                        tags.push(inlineTag);
                    }
                }
                continue;
            }

            if (inTagsSection) {
                if (trimmedLine.startsWith('-')) {
                    const tagMatch = trimmedLine.match(/-\s*(.+)$/);
                    if (tagMatch) {
                        tags.push(tagMatch[1].trim());
                    }
                } else if (trimmedLine && !trimmedLine.startsWith('#')) {
                    break;
                }
            }
        }

        return tags.filter(tag => tag);
    }

    /**
     * Добавить тег в frontmatter
     * @param {TFile} tfile - Файл
     * @param {string} newTag - Тег
     */
    async function addTagToFrontmatter(tfile, newTag) {
        if (!newTag) return;
        await app.fileManager.processFrontMatter(tfile, (frontmatter) => {
            if (!frontmatter.tags) frontmatter.tags = [];
            if (!frontmatter.tags.includes(newTag)) {
                frontmatter.tags.push(newTag);
            }
        });
    }

    /**
     * Установить поле в frontmatter
     * @param {TFile} tfile - Файл
     * @param {string} key - Ключ
     * @param {any} value - Значение
     */
    async function setFrontmatterField(tfile, key, value) {
        await app.fileManager.processFrontMatter(tfile, (frontmatter) => {
            frontmatter[key] = value;
        });
    }

    // ─── ШАБЛОНЫ ─────────────────────────────────────────────────

    /**
     * Заменить шаблонную дату на дату встречи
     * @param {string} content - Содержимое шаблона
     * @param {string} meetingDate - Дата встречи (YYYY-MM-DD)
     * @returns {string}
     */
    function replaceTemplateDateWithMeetingDate(content, meetingDate) {
        const templateStr = "<% tp.date.now() %>";
        const escaped = templateStr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return content.replace(new RegExp(escaped, "g"), meetingDate);
    }

    /**
     * Загрузить шаблоны из файлов
     * @param {Object<string, string>} templates - Объект {ключ: путь}
     * @returns {Promise<Object<string, string>>}
     */
    async function loadTemplates(templates) {
        const allFiles = vault.getMarkdownFiles();
        const loadedTemplates = {};

        for (const [key, path] of Object.entries(templates)) {
            const file = allFiles.find(f => f.path === path);
            if (!file) {
                new Notice(`Шаблон не найден: ${ path }`);
                throw new Error(`Шаблон не найден: ${ path }`);
            }
            loadedTemplates[key] = await vault.read(file);
        }

        return loadedTemplates;
    }

    // ─── ЭКСПОРТ ─────────────────────────────────────────────────

    return {
        // Диалоги
        inputPrompt,
        yesNoPrompt,
        suggester,
        checkboxPrompt,
        selectFromFolder,
        
        // Файлы
        ensureFolderExists,
        getUniqueFilePath,
        
        // Frontmatter
        parseFrontmatterTags,
        addTagToFrontmatter,
        setFrontmatterField,
        
        // Шаблоны
        replaceTemplateDateWithMeetingDate,
        loadTemplates
    };
}
