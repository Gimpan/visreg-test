import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { getFilesInDir, getSuiteDirOrFail, printColorText } from '../../utils';
import { TestConfig } from '../../types';
import { serverPort } from '../config';

let suiteSlug = '';
let snapsFilePath = '';
let fileName = '';

const suiteConfigCache = new Map<string, TestConfig>();

const runSuiteConfig = async (): Promise<void> => {
	if (!suiteSlug) {
		printColorText('runSuiteConfig: No suite path - see README', '31');
		return;
	}

	process.env.SEND_SUITE_CONF = 'true';

	const suiteConfigDir = getSuiteDirOrFail(suiteSlug);
	const isTypescript = fs.existsSync(path.join(suiteConfigDir, 'snaps.ts'));
	fileName = isTypescript ? 'snaps.ts' : 'snaps.js';
	snapsFilePath = path.join(suiteConfigDir, fileName);

	return new Promise((resolve, reject) => {
		let child;

		// I think I can use this for both prod and dev, but pathToCypressContextWrapperSafe I definitely can
		// const pathToCypressContextWrapperSafe = './node_modules/visreg-test/dist/server/services/run-snaps-in-cypress-context.js';
		const pathToCypressContextWrapper = path.join(__dirname, 'run-snaps-in-cypress-context.js');

		child = spawn(`npx tsx ${pathToCypressContextWrapper}`, {
			shell: true,
			stdio: 'inherit',
			env: {
				...process.env,
				FILE_PATH: snapsFilePath,
			}
		});

		child.on('data', (data) => console.log(`${data}`));
		child.on('error', (error) => {
			console.error(`exec error: ${error}`);
			reject();
		});
		child.on('close', (code) => {
			// At this point the snaps.ts/js file has been run, making a POST request to /receive-suite-config, thereby setting the suiteConfigCache
			if (code !== 0) {
				printColorText('Error getting suite test configuration', '33');
				reject();
				return;
			}

			resolve();
		});
	});
};

export const setSuiteConfigCache = (testConfig: TestConfig) => {
	const suiteConfigDir = getSuiteDirOrFail(suiteSlug);
	const filesInDir = getFilesInDir(suiteConfigDir).filter(file => file !== '.DS_Store');

	const parsedTestConfig = {
		...testConfig,
		suiteSlug,
		directory: suiteConfigDir,
		files: filesInDir,
		fileEndpoint: `http://localhost:${serverPort}/files/${suiteSlug}/`,
	};

	suiteConfigCache.set(suiteSlug, parsedTestConfig);
};

export const fetchSuiteConfig = async (incomingSuiteSlug: string) => {
	if (suiteConfigCache.has(incomingSuiteSlug)) {
		return suiteConfigCache.get(incomingSuiteSlug);
	}

	suiteSlug = incomingSuiteSlug;

	await runSuiteConfig();
	return suiteConfigCache.get(suiteSlug);
};
