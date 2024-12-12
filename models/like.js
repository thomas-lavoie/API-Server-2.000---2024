import Model from './model.js';

export default class Like extends Model {
    constructor() {
        super(false /* secured Id */);

        this.addField('user_id', 'string');
        this.addField('post_id', 'string');
        this.addField('username', 'string');
    }
}