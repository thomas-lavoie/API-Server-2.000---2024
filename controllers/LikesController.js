import LikeModel from '../models/like.js';
import Repository from '../models/repository.js';
import Controller from './Controller.js';
import AccessControl from '../accessControl.js';

export default class LikesController extends Controller {
    constructor(HttpContext) {
        super(HttpContext, new Repository(new LikeModel()), AccessControl.anonymous());
    }

    index(id) {
        if (id != '') {
            if (AccessControl.readGranted(this.HttpContext.authorizations, AccessControl.admin()))
                this.HttpContext.response.JSON(this.repository.get(id));
            else
                this.HttpContext.response.unAuthorized("Unauthorized access");
        }
        else {
            if (AccessControl.granted(this.HttpContext.authorizations, AccessControl.admin()))
                this.HttpContext.response.JSON(this.repository.getAll(this.HttpContext.path.params), this.repository.ETag, false, AccessControl.admin());
            else
                this.HttpContext.response.unAuthorized("Unauthorized access");
        }
    }

    add(like) {
        if (this.repository != null) {
            let newLike = this.repository.add(like);
            if (this.model.state.isValid) {
                this.HttpContext.response.created(newLike);
            }
        }
    }

    liked() {
        const user_id = this.HttpContext.path.params.user_id;
        const post_id = this.HttpContext.path.params.post_id;
    
        if (!user_id || !post_id) {
            this.HttpContext.response.badRequest("user_id and post_id are required.");
            return;
        }
    
        if (this.repository != null) {
            // Check if the like exists
            const likeExists = this.repository.objects().some(
                (like) => like.user_id === user_id && like.post_id === post_id
            );
    
            this.HttpContext.response.JSON({ liked: likeExists });
        } else {
            this.HttpContext.response.notImplemented("Repository is not initialized.");
        }
    }
    
}