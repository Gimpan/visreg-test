import { AssessmentData } from './pages/assessment-page/types';
import { TestConfig } from './types';
import { api } from './shared';

export type GetImagesListParams = {
    suiteSlug: string;
    typeOfImage: 'diff' | 'baseline' | 'received';
};

export type GetSuiteImagesListParams = {
    suiteSlug: string;
};

export const getAssessmentData = async (suiteSlug?: string): Promise<AssessmentData> => {
    const response = await fetch(api + '/assessment/diffs-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suiteSlug }),
    });

    const data = await response.json();
    return data;
};

export const getSummary = async () => {
    const response = await fetch(api + '/assessment/summary');
    const summary = await response.json();
    return summary;
};

export const getProjectInformation = async () => {
    const response = await fetch(api + '/project-information');
    const projectInformation = await response.json();
    return projectInformation;
};

export const getSuiteConfig = async (suiteSlug?: string): Promise<TestConfig> => {
    const response = await fetch(api + '/suite/get-suite-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suiteSlug: suiteSlug }),
    });

    const suiteConfig = await response.json();
    return suiteConfig;
};


export const getSuiteImagesList = async (suiteSlug?: string) => {
    if (!suiteSlug) {
        return {
            diffList: [],
            baselineList: [],
            receivedList: [],
        };
    }

    const diffList = await getImagesList({ suiteSlug, typeOfImage: 'diff' });
    const baselineList = await getImagesList({ suiteSlug, typeOfImage: 'baseline' });
    const receivedList = await getImagesList({ suiteSlug, typeOfImage: 'received' });

    return {
        diffList,
        baselineList,
        receivedList
    };
};

export const getImagesList = async (args: GetImagesListParams) => {
    const { suiteSlug, typeOfImage } = args;

    const url = `${api}/images/list/${suiteSlug}/${typeOfImage}-list`;
    const response = await fetch(url);
    const images = await response.json();

    return images;
};

export type GetFileDetailsParams = {
    suiteSlug: string;
    fileName: string;
};

export const getImageDetails = async (args: GetFileDetailsParams) => {
    const { suiteSlug, fileName } = args;
    const url = `${api}/images/image/${suiteSlug}/${fileName}`;
    const response = await fetch(url);
    const image = await response.json();

    return image;
};
