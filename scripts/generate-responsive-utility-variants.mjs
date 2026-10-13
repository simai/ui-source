import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_VARIANT = 'xl';
const TARGET_VARIANT = 'xxl';
const REQUIRED_RESPONSIVE_VARIANTS = Object.freeze(['sm', 'md', 'lg', 'xl']);
const TEXT_EXTENSIONS = new Set(['.js', '.scss']);

function listFiles(root)
{
    const files = [];

    for (const entry of fs.readdirSync(root, { withFileTypes: true }))
    {
        const absolute = path.join(root, entry.name);

        if (entry.isDirectory())
        {
            files.push(...listFiles(absolute));
        }
        else if (entry.isFile())
        {
            files.push(absolute);
        }
    }

    return files.sort();
}

function responsiveFamilies(utilityRoot)
{
    return fs.readdirSync(utilityRoot, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)
        .filter((family) => {
            const familyRoot = path.join(utilityRoot, family);

            return REQUIRED_RESPONSIVE_VARIANTS.every(variant =>
                fs.existsSync(path.join(familyRoot, variant)));
        })
        .sort();
}

function transformContents(contents, extension, family)
{
    if (!TEXT_EXTENSIONS.has(extension))
    {
        return contents;
    }

    let result = contents;

    if (extension === '.js')
    {
        result = result
            .replaceAll(`'${family}/${SOURCE_VARIANT}'`, `'${family}/${TARGET_VARIANT}'`)
            .replaceAll(`"${family}/${SOURCE_VARIANT}"`, `"${family}/${TARGET_VARIANT}"`)
            .replaceAll(`${SOURCE_VARIANT}\\:`, `${TARGET_VARIANT}\\:`)
            .replaceAll(`${SOURCE_VARIANT}:`, `${TARGET_VARIANT}:`);
    }

    if (extension === '.scss')
    {
        result = result
            .replaceAll(`breakpoint-media(${SOURCE_VARIANT})`, `breakpoint-media(${TARGET_VARIANT})`)
            .replaceAll(`breakpoint-infix(${SOURCE_VARIANT},`, `breakpoint-infix(${TARGET_VARIANT},`)
            .replaceAll(`layer-priority(utility,${SOURCE_VARIANT})`, `layer-priority(utility,${TARGET_VARIANT})`)
            .replaceAll(`$infix: ${SOURCE_VARIANT};`, `$infix: ${TARGET_VARIANT};`)
            .replaceAll(`$mobile: ${SOURCE_VARIANT};`, `$mobile: ${TARGET_VARIANT};`)
            .replaceAll(`--sf-breakpoint-${SOURCE_VARIANT}`, `--sf-breakpoint-${TARGET_VARIANT}`);
    }

    return result
        .replace(/[ \t]+$/gm, '')
        .replace(/\n+$/, '\n');
}

function expectedFiles(utilityRoot, family)
{
    const sourceRoot = path.join(utilityRoot, family, SOURCE_VARIANT);

    return listFiles(sourceRoot).map((sourcePath) => {
        const relativePath = path.relative(sourceRoot, sourcePath);
        const extension = path.extname(sourcePath);
        const source = fs.readFileSync(sourcePath, 'utf8');

        return {
            contents: transformContents(source, extension, family),
            relativePath,
        };
    });
}

function verifyFamily(utilityRoot, family)
{
    const targetRoot = path.join(utilityRoot, family, TARGET_VARIANT);
    const expected = expectedFiles(utilityRoot, family);
    const actualFiles = fs.existsSync(targetRoot)
        ? listFiles(targetRoot).map(file => path.relative(targetRoot, file))
        : [];
    const expectedPaths = expected.map(file => file.relativePath);
    const errors = [];

    if (actualFiles.join('\n') !== expectedPaths.join('\n'))
    {
        errors.push(`${family}: file list differs from ${SOURCE_VARIANT}`);
    }

    for (const file of expected)
    {
        const targetPath = path.join(targetRoot, file.relativePath);

        if (!fs.existsSync(targetPath))
        {
            errors.push(`${family}/${TARGET_VARIANT}/${file.relativePath}: missing`);
            continue;
        }

        if (fs.readFileSync(targetPath, 'utf8') !== file.contents)
        {
            errors.push(`${family}/${TARGET_VARIANT}/${file.relativePath}: stale`);
        }
    }

    return errors;
}

function writeFamily(utilityRoot, family)
{
    const targetRoot = path.join(utilityRoot, family, TARGET_VARIANT);

    fs.rmSync(targetRoot, { force: true, recursive: true });

    for (const file of expectedFiles(utilityRoot, family))
    {
        const targetPath = path.join(targetRoot, file.relativePath);

        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, file.contents);
    }
}

function registryContracts(repositoryRoot, families)
{
    const contracts = [
        {
            path: path.join(repositoryRoot, 'src/core/js/rule.src.js'),
            sourceLine: family => `import '../../utility/${family}/${SOURCE_VARIANT}/rule.js';`,
            targetLine: family => `import '../../utility/${family}/${TARGET_VARIANT}/rule.js';`,
        },
        {
            path: path.join(repositoryRoot, 'src/core/utility-full.js'),
            sourceLine: family => `import '../utility/${family}/${SOURCE_VARIANT}/index.scss';`,
            targetLine: family => `import '../utility/${family}/${TARGET_VARIANT}/index.scss';`,
        },
    ];

    return contracts.map((contract) => {
        const contents = fs.readFileSync(contract.path, 'utf8');

        return {
            ...contract,
            families: families.filter(family => contents.includes(contract.sourceLine(family))),
        };
    });
}

function expectedRegistry(contract)
{
    let contents = fs.readFileSync(contract.path, 'utf8');

    for (const family of contract.families)
    {
        const sourceLine = contract.sourceLine(family);
        const targetLine = contract.targetLine(family);

        if (!contents.includes(sourceLine))
        {
            throw new Error(`${path.relative(process.cwd(), contract.path)} is missing ${sourceLine}`);
        }

        if (!contents.includes(targetLine))
        {
            contents = contents.replace(sourceLine, `${sourceLine}\n${targetLine}`);
        }
    }

    return contents;
}

export function generateResponsiveUtilityVariants({ check = false, repositoryRoot })
{
    const utilityRoot = path.join(repositoryRoot, 'src', 'utility');
    const families = responsiveFamilies(utilityRoot);

    if (families.length === 0)
    {
        throw new Error('No responsive utility families were found');
    }

    if (!check)
    {
        for (const family of families)
        {
            writeFamily(utilityRoot, family);
        }

        for (const contract of registryContracts(repositoryRoot, families))
        {
            fs.writeFileSync(contract.path, expectedRegistry(contract));
        }
    }

    const errors = families.flatMap(family => verifyFamily(utilityRoot, family));

    for (const contract of registryContracts(repositoryRoot, families))
    {
        const actual = fs.readFileSync(contract.path, 'utf8');
        const expected = expectedRegistry(contract);

        if (actual !== expected)
        {
            errors.push(`${path.relative(repositoryRoot, contract.path)}: missing ${TARGET_VARIANT} imports`);
        }
    }

    if (errors.length > 0)
    {
        throw new Error(`Responsive utility variants are incomplete:\n${errors.join('\n')}`);
    }

    return { families, source: SOURCE_VARIANT, target: TARGET_VARIANT };
}

const scriptPath = fileURLToPath(import.meta.url);

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath)
{
    const check = process.argv.includes('--check');
    const repositoryRoot = path.resolve(path.dirname(scriptPath), '..');
    const result = generateResponsiveUtilityVariants({ check, repositoryRoot });

    process.stdout.write(`${check ? 'Verified' : 'Generated'} ${result.target} variants for ${result.families.length} responsive utility families.\n`);
}
