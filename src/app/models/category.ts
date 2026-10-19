export interface CategoryInterface {
    id: string;
    type: string;
    color: string;
}

export type CreateategoryPayload = Omit<CategoryInterface, 'id'>;