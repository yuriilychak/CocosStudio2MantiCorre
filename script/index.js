const addUIToBundle = require("./uiParser");
const addFontToBundle = require("./fontParser");
const generateAtlases = require("./atlasParser");
const fileUtil = require("./fileUtils");
const fs = require("fs"); 
const path = require('path');

/**
 * @desc Dir name for export bundles.
 * @type {string}
 */

const exportDir = "export";

/**
 * @desc Dir name that contain source files.
 * @type {string}
 */

const sourceDir = "cocosstudio";

/**
 * @desc Working directory of script.
 * @type {string}
 */

const workingDir = process.cwd();

/**
 * @desc Path of export dir.
 * @type {string}
 */

const exportPath = path.join(workingDir, exportDir);

/**
 * @desc Array with directories that parse script.
 * @type {string[]}
 */

const dirs = fs.readdirSync(workingDir).filter(file => fs.statSync(path.join(workingDir, file)).isDirectory());

/**
 * @desc Array with asset directories that parse script.
 * @type {string[]}
 */

const assetDirs = dirs.filter(dir => fs.readdirSync(dir).includes(sourceDir));

/**
 * @desc Generate asset bandle from source.
 * @function
 * @param {string} dirName - Name of dir
 */

function generateAssetBundle(dirName) {
    const actionTemplates = [
        "Bundle '{0}' generation {1};",
        "Has '{0}' elements: {1};",
        "Generate {0} bundles;",
        "Bundle '{0}' doesn't have {1} elements. Step skipped;",
        "Clear '{0}' export dir"
    ];
    const errorTemplates = [
        "Error '{0}' asset don't have '{1}' folder in '{2}';"
    ];

    logMessage(actionTemplates[4], dirName);

    fileUtil.clearDir(exportPath, dirName);
    fileUtil.createDir(dirName, exportPath);

    logMessage(actionTemplates[0], dirName, "start");

    const rootDirPath = path.join(workingDir, dirName);
    const projectFiles = fs.readdirSync(rootDirPath);
    const assetDir = "export";

    if (projectFiles.indexOf(assetDir) === -1) {
        logMessage(errorTemplates[0], dirName, assetDir, rootDirPath);
        return;
    }

    const assetDirPath = path.join(rootDirPath, assetDir);
    const assetDirs = fs.readdirSync(assetDirPath);
    const elementDir = "element";

    if (assetDirs.indexOf(elementDir) === -1) {
        logMessage(errorTemplates[0], dirName, elementDir, assetDirPath);
        return;
    }

    const sourceDirPath = path.join(rootDirPath, sourceDir);
    const fontBundle = addFontToBundle(dirName, sourceDirPath);

    generateAtlases(fontBundle, dirName, sourceDirPath, workingDir, path.join(exportPath, dirName), (atlasBundle) => {
        const elementDirPath = path.join(assetDirPath, elementDir);
        const elementDirs = fs.readdirSync(elementDirPath);

        const desktopDir = "desktop";
        const commonDir = "common";
        const mobileDir = "mobile";
        const hasCommon = elementDirs.indexOf(commonDir) !== -1;
        const hasDesktop = elementDirs.indexOf(desktopDir) !== -1;
        const hasMobile = elementDirs.indexOf(desktopDir) !== -1;
        const desktopPath = hasDesktop ? path.join(elementDirPath, desktopDir) : null;
        const mobilePath = hasMobile ? path.join(elementDirPath, mobileDir) : null;
        const commonPath = hasCommon ? path.join(elementDirPath, commonDir) : null;

        logMessage(actionTemplates[1], commonDir, hasCommon);
        logMessage(actionTemplates[1], desktopDir, hasDesktop);
        logMessage(actionTemplates[1], mobileDir, hasMobile);

        if (hasDesktop || hasCommon) {
            const bundle = createEmptyAssetBundle();
            bundle.fonts = fontBundle.names;
            bundle.fontData = fontBundle.data;
            logMessage(actionTemplates[2], desktopDir);
            createAssetBundle(bundle, desktopPath, commonPath, dirName, false);
        }
        else {
            logMessage(actionTemplates[3], dirName, desktopDir);
        }

        if (hasMobile || hasCommon) {
            const bundle = createEmptyAssetBundle();
            bundle.fonts = fontBundle.names;
            bundle.fontData = fontBundle.data;
            logMessage(actionTemplates[2], mobileDir);
            createAssetBundle(bundle, mobilePath, commonPath, dirName, true);
        }
        else {
            logMessage(actionTemplates[3], dirName, mobileDir);
        }

        logMessage(actionTemplates[0], dirName, "finish");
    });
}


/**
 * @desc Create asset bundle.
 * @function
 * @param {?string} mainPath
 * @param {?string} commonPath
 * @param {string} name
 * @param {boolean} isMobile
 */
function createAssetBundle(bundle, mainPath, commonPath, name, isMobile) {
    const bundleName = "bundle_" + (isMobile ? "m" : "d") + ".json";
    const bundlePath = path.join(exportPath, name);
    const exportDirs = fs.readdirSync(exportPath);
    const bundleFilePath = path.join(bundlePath, bundleName);

    if (exportDirs.indexOf(name) === -1) {
        fs.mkdirSync(bundlePath);
    }
    const uiData = {
        names: [],
        data: []
    };

    getAssetElementData(uiData, mainPath);
    getAssetElementData(uiData, commonPath);

    addUIToBundle(bundle, uiData);

    fs.writeFileSync(bundleFilePath, JSON.stringify(bundle));
}


/**
 * @desc Returns asset element names and data
 * @function
 * @param {{names: string[], data: Object[]}} uiData
 * @param {?string} dirPath
 */

function getAssetElementData(uiData, dirPath)  {
    if (dirPath === null) {
        return;
    }

    const suffix = ".json";
    const content = fs.readdirSync(dirPath);
    const assets = content.filter(asset => asset.indexOf(suffix) !== -1);

    uiData.names = uiData.names.concat(assets.map(asset => asset.replace(suffix, "")));

    uiData.data = uiData.data.concat(assets.map(asset => {
        const assetPath = path.join(dirPath, asset);
        const data = JSON.parse(fs.readFileSync(assetPath));
        return data["Content"]["Content"]["ObjectData"];
    }));
}

/**
 * @desc Generate empty asset bundle
 * @function
 * @returns {Object}
 */

function createEmptyAssetBundle() {
    return {
        anchors: [],
        atlasFonts: [],
        colors: [],
        componentNames: [],
        elementNames: [],
        fonts: [],
        fontData: [],
        fontStyles: [],
        texts: [],
        textFieldStyles: [],
        textures: [],
        textureParts: [],
        ui: []
    }
}


/**
 * @desc Log step messages
 * @function
 * @param {...*} var_args
 */

function logMessage(var_args) {
    const argumentCount = arguments.length;
    let result;

    if (argumentCount === 1) {
        result = arguments[0];
    }
    else {
        const template = "{0}";
        result = arguments[0];
        for (let i = 1; i < argumentCount; ++i) {
            result = result.replace(template.replace("0", i - 1), arguments[i].toString());
        }
    }
    console.log(result);
}

if (dirs.indexOf(exportDir) === -1) {
    fs.mkdirSync(exportPath);
}

assetDirs.forEach(dir => generateAssetBundle(dir));