//Шаблон скрипта для Obsidian QuickAdd Plugin 
//https://quickadd.obsidian.guide/docs/QuickAddAPI
module.exports = async (params) => {
    const { app, quickAddApi } = params;
    const { vault, workspace } = app;

    try {

    } catch (error) {
        console.error("Ошибка при выполнении скрипта:", error);
        await new Notice("Произошла ошибка при создании задачи.");
    }
};