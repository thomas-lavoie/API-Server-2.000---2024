////// Author: Nicolas Chourot
////// 2024
//////////////////////////////

const periodicRefreshPeriod = 2;
const waitingGifTrigger = 2000;
const minKeywordLenth = 3;
const keywordsOnchangeDelay = 500;

const API_IP = "http://localhost:5000";
// const API_IP = "https://knowing-nine-intelligence.glitch.me/";

let categories = [];
let selectedCategory = "";
let currentETag = "";
let currentPostsCount = -1;
let periodic_Refresh_paused = false;
let postsPanel;
let itemLayout;
let waiting = null;
let showKeywords = false;
let keywordsOnchangeTimger = null;

Init_UI();
async function Init_UI() {
  postsPanel = new PageManager(
    "postsScrollPanel",
    "postsPanel",
    "postSample",
    renderPosts
  );
  $("#createPost").on("click", async function () {
    showCreatePostForm();
  });
  $("#abort").on("click", async function () {
    showPosts();
  });
  $("#aboutCmd").on("click", function () {
    showAbout();
  });
  $("#showSearch").on("click", function () {
    toogleShowKeywords();
    showPosts();
  });

  installKeywordsOnkeyupEvent();
  await showPosts();
  start_Periodic_Refresh();
}

/////////////////////////// Search keywords UI //////////////////////////////////////////////////////////

function installKeywordsOnkeyupEvent() {
  $("#searchKeys").on("keyup", function () {
    clearTimeout(keywordsOnchangeTimger);
    keywordsOnchangeTimger = setTimeout(() => {
      cleanSearchKeywords();
      showPosts(true);
    }, keywordsOnchangeDelay);
  });
  $("#searchKeys").on("search", function () {
    showPosts(true);
  });
}
function cleanSearchKeywords() {
  /* Keep only keywords of 3 characters or more */
  let keywords = $("#searchKeys").val().trim().split(" ");
  let cleanedKeywords = "";
  keywords.forEach((keyword) => {
    if (keyword.length >= minKeywordLenth) cleanedKeywords += keyword + " ";
  });
  $("#searchKeys").val(cleanedKeywords.trim());
}
function showSearchIcon() {
  $("#hiddenIcon").hide();
  $("#showSearch").show();
  if (showKeywords) {
    $("#searchKeys").show();
  } else $("#searchKeys").hide();
}
function hideSearchIcon() {
  $("#hiddenIcon").show();
  $("#showSearch").hide();
  $("#searchKeys").hide();
}
function toogleShowKeywords() {
  showKeywords = !showKeywords;
  if (showKeywords) {
    $("#searchKeys").show();
    $("#searchKeys").focus();
  } else {
    $("#searchKeys").hide();
    showPosts(true);
  }
}

/////////////////////////// Views management ////////////////////////////////////////////////////////////

function intialView() {
  let user = JSON.parse(sessionStorage.getItem("user"));
  if (user && user.Authorizations.writeAccess >= 2) {
    $("#createPost").show();
  } else {
    $("#createPost").hide();
  }
  $("#hiddenIcon").hide();
  $("#hiddenIcon2").hide();
  $("#menu").show();
  $("#commit").hide();
  $("#abort").hide();
  $("#form").hide();
  $("#form").empty();
  $("#aboutContainer").hide();
  $("#errorContainer").hide();
  showSearchIcon();
}
async function showPosts(reset = false) {
  let user = JSON.parse(sessionStorage.getItem("user"));
  intialView();
  $("#viewTitle").text("Fil de nouvelles");
  periodic_Refresh_paused = false;
  await postsPanel.show(reset);
  if (user) {
    initTimeout(360, function () {
      $.ajax({
        url: `${API_IP}/accounts/logout?userId=${user.Id}`,
        method: "GET",
        success: function () {
          sessionStorage.clear();
          user = null;
          updateDropDownMenu();
          showPosts();
        },
      });
    });
    timeout();
  }
}
function hidePosts(keepMenu = false) {
  postsPanel.hide();
  hideSearchIcon();
  $("#createPost").hide();
  if (!keepMenu) $("#menu").hide();
  periodic_Refresh_paused = true;
}
function showLogin() {
  hidePosts();
  $("#abort").show();
}
function showVerify() {
  hidePosts(true);
}
function showManageUsers() {
  hidePosts();
  $("#abort").show();
}
function showModification() {
  hidePosts();
  $("#abort").show();
}
function showForm() {
  hidePosts();
  $("#form").show();
  $("#commit").show();
  $("#abort").show();
}
function showError(message, details = "") {
  hidePosts();
  $("#form").hide();
  $("#form").empty();
  $("#hiddenIcon").show();
  $("#hiddenIcon2").show();
  $("#commit").hide();
  $("#abort").show();
  $("#viewTitle").text("Erreur du serveur...");
  $("#errorContainer").show();
  $("#errorContainer").empty();
  $("#errorContainer").append($(`<div>${message}</div>`));
  $("#errorContainer").append($(`<div>${details}</div>`));
}

function showLoginPage(info = "") {
  showLogin();
  $("#viewTitle").text("Connexion");
  renderLoginForm(null, info);
}
function showVerifyPage(user = null) {
  showVerify();
  $("#viewTitle").text("Vérification");
  renderVerificationForm(user);
  timeout();
}
function showManageUsersPage(user) {
  showManageUsers();
  $("#viewTitle").text("Gestion des usagers");
  renderManageUsers(user);
  timeout();
}
function showModificationPage(user) {
  showModification();
  $("#viewTitle").text("Modification");
  renderModificationForm(user);
  timeout();
}
function showCreatePostForm() {
  showForm();
  $("#viewTitle").text("Ajout de nouvelle");
  renderPostForm();
  timeout();
}
function showEditPostForm(id) {
  showForm();
  $("#viewTitle").text("Modification");
  renderEditPostForm(id);
  timeout();
}
function showDeletePostForm(id) {
  showForm();
  $("#viewTitle").text("Retrait");
  renderDeletePostForm(id);
  timeout();
}
function showAbout() {
  hidePosts();
  $("#hiddenIcon").show();
  $("#hiddenIcon2").show();
  $("#abort").show();
  $("#viewTitle").text("À propos...");
  $("#aboutContainer").show();
  timeout();
}

//////////////////////////// Posts rendering /////////////////////////////////////////////////////////////

//////////////////////////// Posts rendering /////////////////////////////////////////////////////////////

function start_Periodic_Refresh() {
  $("#reloadPosts").addClass("white");
  $("#reloadPosts").on("click", async function () {
    $("#reloadPosts").addClass("white");
    postsPanel.resetScrollPosition();
    await showPosts();
  });
  setInterval(async () => {
    if (!periodic_Refresh_paused) {
      let etag = await Posts_API.HEAD();
      // the etag contain the number of model records in the following form
      // xxx-etag
      let postsCount = parseInt(etag.split("-")[0]);
      if (currentETag != etag) {
        if (postsCount != currentPostsCount) {
          console.log("postsCount", postsCount);
          currentPostsCount = postsCount;
          $("#reloadPosts").removeClass("white");
        } else await showPosts();
        currentETag = etag;
      }
    }
  }, periodicRefreshPeriod * 1000);
}

async function getLikes() {
  const token = sessionStorage.getItem("bearerToken");
  const response = await fetch(`${API_IP}/api/likes`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  return await response.json();
}

async function renderPosts(queryString) {
  let user = JSON.parse(sessionStorage.getItem("user"));

  let likesTab = await getLikes();

  let endOfData = false;
  queryString += "&sort=date,desc";
  compileCategories();
  if (selectedCategory != "") queryString += "&category=" + selectedCategory;
  if (showKeywords) {
    let keys = $("#searchKeys").val().replace(/[ ]/g, ",");
    if (keys !== "")
      queryString += "&keywords=" + $("#searchKeys").val().replace(/[ ]/g, ",");
  }
  addWaitingGif();
  let response = await Posts_API.Get(queryString);
  if (!Posts_API.error) {
    currentETag = response.ETag;
    currentPostsCount = parseInt(currentETag.split("-")[0]);
    let Posts = response.data;
    if (Posts.length > 0) {
      Posts.forEach((Post) => {
        postsPanel.append(renderPost(Post, likesTab, user));
      });
    } else endOfData = true;
    linefeeds_to_Html_br(".postText");
    highlightKeywords();
    attach_Posts_UI_Events_Callback();
  } else {
    showError(Posts_API.currentHttpError);
  }
  removeWaitingGif();
  if (user && user.VerifyCode === "unverified") {
    showVerifyPage(user);
  }

  // Click to like
  $(".likeCmd").on("click", async (event) => {
    const token = sessionStorage.getItem("bearerToken");
    const postId = $(event.target).attr("postId");

    let liked = false;
    let likeId = null;
    likesTab.forEach((like) => {
      if (like.post_id == postId && like.user_id == user.Id) {
        liked = true;
        likeId = like.Id;
      }
    });

    if (liked) {
      const response = await fetch(
        `${API_IP}/api/likes/${likeId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
    } else {
      const response = await fetch(`${API_IP}/api/likes`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          post_id: postId,
          user_id: user.Id,
          username: user.Name,
        }),
      });
    }
    showPosts();
  });

  return endOfData;
}

function renderPost(post, likesTab, loggedUser = null) {
  let date = convertToFrenchDate(UTC_To_Local(post.Date));
  let crudIcon = "";
  if (loggedUser && loggedUser.Authorizations.writeAccess >= 2) {
    crudIcon = `
        <span class="editCmd cmdIconSmall fa fa-pencil" postId="${post.Id}" title="Modifier nouvelle"></span>
        <span class="deleteCmd cmdIconSmall fa fa-trash" postId="${post.Id}" title="Effacer nouvelle"></span>
        `;
  }

  let likes = "";
  let likeCount = 0;
  let names = "";
  if (loggedUser && loggedUser.Authorizations.writeAccess >= 1) {
    let liked = false;
    likesTab.forEach((like) => {
      if (like.post_id == post.Id) {
        likeCount++;
        names += `${like.username}\n`;
        if (like.user_id == loggedUser.Id) {
          liked = true;
          likes = `<span class="likeCmd cmdIconSmall fa fa-thumbs-up" id="like-${post.Id}" postId="${post.Id}" title="${names}">${likeCount}</span>`;
        } else {
          likes = `<span class="likeCmd cmdIconSmall fa-regular fa-thumbs-up" id="like-${post.Id}" postId="${post.Id}" title="${names}">${likeCount}</span>`;
        }
      } else {
        if (!liked)
          likes = `<span class="likeCmd cmdIconSmall fa-regular fa-thumbs-up" id="like-${post.Id}" postId="${post.Id}" title="${names}">${likeCount}</span>`;
      }
    });
    if (likesTab.length <= 0) {
      likes = `<span class="likeCmd cmdIconSmall fa-regular fa-thumbs-up" id="like-${post.Id}" postId="${post.Id}" title="${names}">${likeCount}</span>`;
    }
  }

  return $(`
        <div class="post" id="${post.Id}">
            <div class="postHeader">
                <span class="cat">${post.Category}</span>
                ${crudIcon}
                ${likes}
            </div>
            <div class="postTitle"> ${post.Title} </div>
            <img class="postImage" src='${post.Image}'/>
            <div class="postDate"> ${date} </div>
            <div postId="${post.Id}" class="postTextContainer hideExtra">
                <div class="postText" >${post.Text}</div>
            </div>
            <div class="postfooter">
                <span postId="${post.Id}" class="moreText cmdIconXSmall fa fa-angle-double-down" title="Afficher la suite"></span>
                <span postId="${post.Id}" class="lessText cmdIconXSmall fa fa-angle-double-up" title="Réduire..."></span>
            </div>         
        </div>
    `);
}
async function compileCategories() {
  categories = [];
  let response = await Posts_API.GetQuery("?fields=category&sort=category");
  if (!Posts_API.error) {
    let items = response.data;
    if (items != null) {
      items.forEach((item) => {
        if (!categories.includes(item.Category)) categories.push(item.Category);
      });
      if (!categories.includes(selectedCategory)) selectedCategory = "";
      updateDropDownMenu(categories);
    }
  }
}
function updateDropDownMenu() {
  let user = JSON.parse(sessionStorage.getItem("user"));
  let DDMenu = $("#DDMenu");
  let selectClass = selectedCategory === "" ? "fa-check" : "fa-fw";
  DDMenu.empty();
  if (user) {
    DDMenu.append(
      $(`
            <div class="dropdown-item menuItemLayout" id="usernameDD">
                <img id="avatarDD" src="${user.Avatar}" /><b>${user.Name}</b>
            </div>
            `)
    );
    if (user.Authorizations.writeAccess >= 3) {
      DDMenu.append($(`<div class="dropdown-divider"></div>`));
      DDMenu.append(
        $(`
          <div class="dropdown-item menuItemLayout" id="manageUsersLink">
              <i class="menuIcon fa fa-user-gear mx-2"></i> Gestion des usagers
          </div>
          `)
      );
    }
    DDMenu.append($(`<div class="dropdown-divider"></div>`));
    DDMenu.append(
      $(`
          <div class="dropdown-item menuItemLayout" id="modifyUserLink">
              <i class="menuIcon fa fa-user-pen mx-2"></i> Modifier votre profil
          </div>
          `)
    );
    DDMenu.append(
      $(`
          <div class="dropdown-item menuItemLayout" id="logoutLink">
              <i class="menuIcon fa fa-arrow-right-from-bracket mx-2"></i> Deconnexion
          </div>
          `)
    );
    DDMenu.append($(`<div class="dropdown-divider"></div>`));
    $("#logoutLink").on("click", function () {
      $.ajax({
        url: `${API_IP}/accounts/logout?userId=${user.Id}`,
        method: "GET",
        success: function () {
          sessionStorage.clear();
          user = null;
          updateDropDownMenu();
          showPosts();
        },
      });
    });

    if (user.Authorizations.writeAccess >= 3) {
      $("#manageUsersLink").on("click", function () {
        showManageUsersPage(user);
      });
    }

    $("#modifyUserLink").on("click", function () {
      showModificationPage(user);
    });
  } else {
    DDMenu.append(
      $(`
        <div class="dropdown-item menuItemLayout" id="loginLink">
            <i class="menuIcon fa fa-arrow-right-to-bracket mx-2"></i> Connexion
        </div>
        `)
    );
    DDMenu.append($(`<div class="dropdown-divider"></div>`));
  }

  DDMenu.append(
    $(`
        <div class="dropdown-item menuItemLayout" id="allCatCmd">
            <i class="menuIcon fa ${selectClass} mx-2"></i> Toutes les catégories
        </div>
        `)
  );
  DDMenu.append($(`<div class="dropdown-divider"></div>`));
  categories.forEach((category) => {
    selectClass = selectedCategory === category ? "fa-check" : "fa-fw";
    DDMenu.append(
      $(`
            <div class="dropdown-item menuItemLayout category" id="allCatCmd">
                <i class="menuIcon fa ${selectClass} mx-2"></i> ${category}
            </div>
        `)
    );
  });
  DDMenu.append($(`<div class="dropdown-divider"></div> `));
  DDMenu.append(
    $(`
        <div class="dropdown-item menuItemLayout" id="aboutCmd">
            <i class="menuIcon fa fa-info-circle mx-2"></i> À propos...
        </div>
        `)
  );
  $("#loginLink").on("click", function () {
    showLoginPage();
  });
  $("#aboutCmd").on("click", function () {
    showAbout();
  });
  $("#allCatCmd").on("click", async function () {
    selectedCategory = "";
    await showPosts(true);
    updateDropDownMenu();
  });
  $(".category").on("click", async function () {
    selectedCategory = $(this).text().trim();
    await showPosts(true);
    updateDropDownMenu();
  });
}
function attach_Posts_UI_Events_Callback() {
  linefeeds_to_Html_br(".postText");
  // attach icon command click event callback
  $(".editCmd").off();
  $(".editCmd").on("click", function () {
    showEditPostForm($(this).attr("postId"));
  });
  $(".deleteCmd").off();
  $(".deleteCmd").on("click", function () {
    showDeletePostForm($(this).attr("postId"));
  });
  $(".moreText").off();
  $(".moreText").click(function () {
    $(`.commentsPanel[postId=${$(this).attr("postId")}]`).show();
    $(`.lessText[postId=${$(this).attr("postId")}]`).show();
    $(this).hide();
    $(`.postTextContainer[postId=${$(this).attr("postId")}]`).addClass(
      "showExtra"
    );
    $(`.postTextContainer[postId=${$(this).attr("postId")}]`).removeClass(
      "hideExtra"
    );
  });
  $(".lessText").off();
  $(".lessText").click(function () {
    $(`.commentsPanel[postId=${$(this).attr("postId")}]`).hide();
    $(`.moreText[postId=${$(this).attr("postId")}]`).show();
    $(this).hide();
    postsPanel.scrollToElem($(this).attr("postId"));
    $(`.postTextContainer[postId=${$(this).attr("postId")}]`).addClass(
      "hideExtra"
    );
    $(`.postTextContainer[postId=${$(this).attr("postId")}]`).removeClass(
      "showExtra"
    );
  });
}
function addWaitingGif() {
  clearTimeout(waiting);
  waiting = setTimeout(() => {
    postsPanel.itemsPanel.append(
      $(
        "<div id='waitingGif' class='waitingGifcontainer'><img class='waitingGif' src='Loading_icon.gif' /></div>'"
      )
    );
  }, waitingGifTrigger);
}
function removeWaitingGif() {
  clearTimeout(waiting);
  $("#waitingGif").remove();
}

/////////////////////// Posts content manipulation ///////////////////////////////////////////////////////

function linefeeds_to_Html_br(selector) {
  $.each($(selector), function () {
    let postText = $(this);
    var str = postText.html();
    var regex = /[\r\n]/g;
    postText.html(str.replace(regex, "<br>"));
  });
}
function highlight(text, elem) {
  text = text.trim();
  if (text.length >= minKeywordLenth) {
    var innerHTML = elem.innerHTML;
    let startIndex = 0;

    while (startIndex < innerHTML.length) {
      var normalizedHtml = innerHTML
        .toLocaleLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      var index = normalizedHtml.indexOf(text, startIndex);
      let highLightedText = "";
      if (index >= startIndex) {
        highLightedText =
          "<span class='highlight'>" +
          innerHTML.substring(index, index + text.length) +
          "</span>";
        innerHTML =
          innerHTML.substring(0, index) +
          highLightedText +
          innerHTML.substring(index + text.length);
        startIndex = index + highLightedText.length + 1;
      } else startIndex = innerHTML.length + 1;
    }
    elem.innerHTML = innerHTML;
  }
}
function highlightKeywords() {
  if (showKeywords) {
    let keywords = $("#searchKeys").val().split(" ");
    if (keywords.length > 0) {
      keywords.forEach((key) => {
        let titles = document.getElementsByClassName("postTitle");
        Array.from(titles).forEach((title) => {
          highlight(key, title);
        });
        let texts = document.getElementsByClassName("postText");
        Array.from(texts).forEach((text) => {
          highlight(key, text);
        });
      });
    }
  }
}

//////////////////////// Forms rendering /////////////////////////////////////////////////////////////////

async function renderEditPostForm(id) {
  $("#commit").show();
  addWaitingGif();
  let response = await Posts_API.Get(id);
  if (!Posts_API.error) {
    let Post = response.data;
    if (Post !== null) renderPostForm(Post);
    else showError("Post introuvable!");
  } else {
    showError(Posts_API.currentHttpError);
  }
  removeWaitingGif();
}
async function renderDeletePostForm(id) {
  let response = await Posts_API.Get(id);
  if (!Posts_API.error) {
    let post = response.data;
    if (post !== null) {
      let date = convertToFrenchDate(UTC_To_Local(post.Date));
      $("#form").append(`
                <div class="post" id="${post.Id}">
                <div class="postHeader">  ${post.Category} </div>
                <div class="postTitle ellipsis"> ${post.Title} </div>
                <img class="postImage" src='${post.Image}'/>
                <div class="postDate"> ${date} </div>
                <div class="postTextContainer showExtra">
                    <div class="postText">${post.Text}</div>
                </div>
            `);
      linefeeds_to_Html_br(".postText");
      // attach form buttons click event callback
      $("#commit").on("click", async function () {
        await Posts_API.Delete(post.Id);
        if (!Posts_API.error) {
          await showPosts();
        } else {
          console.log(Posts_API.currentHttpError);
          showError("Une erreur est survenue!");
        }
      });
      $("#cancel").on("click", async function () {
        await showPosts();
      });
    } else {
      showError("Post introuvable!");
    }
  } else showError(Posts_API.currentHttpError);
}
function newPost() {
  let Post = {};
  Post.Id = 0;
  Post.Title = "";
  Post.Text = "";
  Post.Image = "news-logo-upload.png";
  Post.Category = "";
  return Post;
}
function newUser() {
  let User = {};
  User.Email = "";
  User.Password = "";
  User.Name = "";
  User.Avatar = "no-avatar.png";
  return User;
}
function renderPostForm(post = null) {
  let create = post == null;
  if (create) post = newPost();
  $("#form").show();
  $("#form").empty();
  $("#form").append(`
        <form class="form" id="postForm">
            <input type="hidden" name="Id" value="${post.Id}"/>
             <input type="hidden" name="Date" value="${post.Date}"/>
            <label for="Category" class="form-label">Catégorie </label>
            <input 
                class="form-control"
                name="Category"
                id="Category"
                placeholder="Catégorie"
                required
                value="${post.Category}"
            />
            <label for="Title" class="form-label">Titre </label>
            <input 
                class="form-control"
                name="Title" 
                id="Title" 
                placeholder="Titre"
                required
                RequireMessage="Veuillez entrer un titre"
                InvalidMessage="Le titre comporte un caractère illégal"
                value="${post.Title}"
            />
            <label for="Url" class="form-label">Texte</label>
             <textarea class="form-control" 
                          name="Text" 
                          id="Text"
                          placeholder="Texte" 
                          rows="9"
                          required 
                          RequireMessage = 'Veuillez entrer une Description'>${post.Text}</textarea>

            <label class="form-label">Image </label>
            <div class='imageUploaderContainer'>
                <div class='imageUploader' 
                     newImage='${create}' 
                     controlId='Image' 
                     imageSrc='${post.Image}' 
                     waitingImage="Loading_icon.gif">
                </div>
            </div>
            <div id="keepDateControl">
                <input type="checkbox" name="keepDate" id="keepDate" class="checkbox" checked>
                <label for="keepDate"> Conserver la date de création </label>
            </div>
            <input type="submit" value="Enregistrer" id="savePost" class="btn btn-primary displayNone">
        </form>
    `);
  if (create) $("#keepDateControl").hide();

  initImageUploaders();
  initFormValidation(); // important do to after all html injection!

  $("#commit").click(function () {
    $("#commit").off();
    return $("#savePost").trigger("click");
  });
  $("#postForm").on("submit", async function (event) {
    event.preventDefault();
    let post = getFormData($("#postForm"));
    if (post.Category != selectedCategory) selectedCategory = "";
    if (create || !("keepDate" in post)) post.Date = Local_to_UTC(Date.now());
    delete post.keepDate;
    post = await Posts_API.Save(post, create);
    if (!Posts_API.error) {
      await showPosts();
      postsPanel.scrollToElem(post.Id);
    } else showError("Une erreur est survenue! ", Posts_API.currentHttpError);
  });
  $("#cancel").on("click", async function () {
    await showPosts();
  });
}
function getFormData($form) {
  // prevent html injections
  const removeTag = new RegExp("(<[a-zA-Z0-9]+>)|(</[a-zA-Z0-9]+>)", "g");
  var jsonObject = {};
  // grab data from all controls
  $.each($form.serializeArray(), (index, control) => {
    jsonObject[control.name] = control.value.replace(removeTag, "");
  });
  return jsonObject;
}

function renderVerificationForm(user = null) {
  $("#form").show();
  $("#form").empty();
  $("#form").append(`
        <div class="abcdefg">
        <h2>Veuillez entrer le code de vérification de que vous avez reçu par courriel</h2>
          <form class="form" id="verifForm">
              <input 
                  class="form-control"
                  name="VerifyCode"
                  id="VerifyCode"
                  placeholder="Code de vérification de courriel"
                  required
                  type="number"
              />
              <p style="color: red;" id="errMsg"></p>
              <input type="submit" value="Vérifier" id="verifySubmit" class="btn btn-primary">
          </form>
          </div>
      `);

  initFormValidation(); // important do to after all html injection!

  $("#verifForm").on("submit", async function (event) {
    event.preventDefault();
    $.ajax({
      url: `${API_IP}/accounts/verify?id=${user.Id}&code=${$(
        "#VerifyCode"
      ).val()}`,
      method: "GET",
      success: function (response) {
        user.VerifyCode = "verified";
        sessionStorage.setItem("user", JSON.stringify(user));
        showPosts();
      },
      error: function (error) {
        $("#errMsg").text(error.responseJSON.error_description);
      },
    });
  });
}

async function renderManageUsers(user) {
  const token = sessionStorage.getItem("bearerToken");

  const response = await fetch(`${API_IP}/accounts`, {
    method: "GET",
    headers: {
      Authorization: token,
    },
  });

  const users = await response.json();

  $("#form").show();
  $("#form").empty();
  $("#form").append(
    `<div class="abcdefg">

    </div>`
  );

  users.forEach((item) => {
    if (item.Id != user.Id) {
      let auth = `<i class="menuIcon fa-solid fa-user"></i>`;
      if (item.Authorizations.writeAccess == 2)
        auth = `<i class="menuIcon fa-solid fa-user-pen"></i>`;
      if (item.Authorizations.writeAccess == 3)
        auth = `<i class="menuIcon fa-solid fa-user-shield"></i>`;

      let banned = false;
      let ban = `<i class="menuIcon fa-solid fa-ban"></i>`;
      if (item.Authorizations.writeAccess == 0) {
        ban = `<i class="blockedIcon fa-solid fa-ban"></i>`;
        banned = true;
        auth = "";
      }

      row = `
        <div class="user-row">
          <div class="user-avatar">
            <img id="avatarDD" src="${item.Avatar}" />
          </div>
          <div class="user-contact">
            <b>${item.Name}</b>
            ${item.Email}
          </div>
          <div class="user-auth">
            <div class="iconBtn" id="change-auth-${item.Id}">
              ${auth}
            </div>
            <div class="iconBtn" id="change-ban-${item.Id}">
              ${ban}
            </div>
          </div>
        </div>
      `;

      $(".abcdefg").append(row);

      $(`#change-auth-${item.Id}`).on("click", function (event) {
        event.preventDefault();
        const newUser = {
          Id: item.Id,
          Email: item.Email,
          Password: item.Password,
          Name: item.Name,
          Avatar: item.Avatar,
          Created: item.Created,
          VerifyCode: item.VerifyCode,
          Authorizations: item.Authorizations,
        };
        $.ajax({
          url: `${API_IP}/accounts/promote`,
          method: "POST",
          contentType: "application/json",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          data: JSON.stringify(newUser),
        });
        renderManageUsers(user);
      });

      $(`#change-ban-${item.Id}`).on("click", function (event) {
        event.preventDefault();
        const newUser = {
          Id: item.Id,
          Email: item.Email,
          Password: item.Password,
          Name: item.Name,
          Avatar: item.Avatar,
          Created: item.Created,
          VerifyCode: item.VerifyCode,
          Authorizations: item.Authorizations,
        };
        if (banned) {
          $.ajax({
            url: `${API_IP}/accounts/promote`,
            method: "POST",
            contentType: "application/json",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            data: JSON.stringify(newUser),
          });
        } else {
          $.ajax({
            url: `${API_IP}/accounts/block`,
            method: "POST",
            contentType: "application/json",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            data: JSON.stringify(newUser),
          });
        }
        renderManageUsers(user);
      });
    }
  });
}

function renderModificationForm(user) {
  const token = sessionStorage.getItem("bearerToken");
  $("#form").show();
  $("#form").empty();
  $("#form").append(`
        <div class="abcdefg">
          <form class="form" id="modifyForm">
          <fieldset>
            <legend>Adresse courriel</legend>
            <input type="hidden" id="Id" name="Id" value="${user.Id}"/>
            <input 
                  class="form-control"
                  name="Email"
                  id="Email"
                  placeholder="Courriel"
                  required
                  type="email"
                  value="${user.Email}"
                  CustomErrorMessage="Ce courriel est déjà utilisé"
              />
              <input 
                  class="form-control MatchedInput"
                  name="Email-confirm"
                  id="EmailConfirm"
                  placeholder="Confirmer le courriel"
                  required
                  type="email"
                  matchedInputId="Email"
                  value="${user.Email}"
                  CustomErrorMessage="Les courriels ne correspondent pas"
              />
          </fieldset>
          <fieldset>
            <legend>Mot de passe</legend>
            <input 
                  class="form-control"
                  name="Password"
                  id="Password"
                  placeholder="Mot de passe"
                  required
                  type="password"
                  matchedInputId="PasswordConfirm"
              />
              <input 
                  class="form-control MatchedInput"
                  name="Password-confirm"
                  id="PasswordConfirm"
                  placeholder="Confirmer le mot de passe"
                  required
                  type="password"
                  matchedInputId="Password"
                  CustomErrorMessage="Les mots de passe ne correspondent pas"
              />
          </fieldset>
          <fieldset>
            <legend>Nom</legend>
            <input 
                class="form-control"
                name="Name"
                id="Name"
                placeholder="Nom"
                required
                type="text"
                value="${user.Name}"
              />
          </fieldset>
          <fieldset>
            <legend>Avatar</legend>
            <label class="form-label">Image </label>
            <div class='imageUploaderContainer'>
                <div class='imageUploader'
                     newImage='${false}'
                     controlId='Avatar'
                     imageSrc='${user.Avatar}' 
                     waitingImage="Loading_icon.gif">
                </div>
            </div>
          </fieldset>
          <input type="submit" value="Enregistrer" id="modifySubmit" class="btn btn-primary">
          </form>
          <button class="btn btn-warning" id="delete">Effacer le compte</button>
          </div>
      `);

  initFormValidation(); // important do to after all html injection!
  initImageUploaders();
  addConflictValidation(
    `${API_IP}/accounts/conflict`,
    "Email",
    "modifySubmit"
  );

  $("#modifyForm").on("submit", async function (event) {
    event.preventDefault();
    const formUser = getFormData($("#modifyForm"));
    const newUser = {
      Id: user.Id,
      Email: formUser.Email,
      Password: formUser.Password,
      Name: formUser.Name,
      Avatar: formUser.Avatar,
      Created: user.Created,
      VerifyCode: user.VerifyCode,
      Authorizations: user.Authorizations,
    };
    $.ajax({
      url: `${API_IP}/accounts/modify`,
      method: "PUT",
      contentType: "application/json",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: JSON.stringify(newUser),
      success: function (response) {
        sessionStorage.setItem("user", JSON.stringify(response));
        showPosts();
      },
      error: function (error) {
        $("#errMsg").text(error.responseJSON.error_description);
      },
    });
  });

  $("#delete").on("click", async () => {
    $.ajax({
      url: `${API_IP}/accounts/remove/${user.Id}`,
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      success: function (response) {
        sessionStorage.clear();
        updateDropDownMenu();
        showPosts();
      },
      error: function (error) {
        $("#errMsg").text(error.responseJSON.error_description);
      },
    });
  });
}

function renderLoginForm(user = null, info = "") {
  let create = user == null;
  if (create) user = newUser();
  $("#form").show();
  $("#form").empty();
  $("#form").append(`
        <div class="abcdefg">
          <h2 id="info">${info}</h2>
          <form class="form" id="loginForm">
              <input 
                  class="form-control"
                  name="Email"
                  id="Email"
                  placeholder="Courriel"
                  required
                  type="email"
                  value="${user.Email}"
              />
              <input 
                  class="form-control"
                  name="Password"
                  id="Password"
                  placeholder="Mot de passe"
                  required
                  type="password"
                  value="${user.Password}"
              />
              <p style="color: red;" id="errMsg"></p>
              <input type="submit" value="Entrer" id="loginSubmit" class="btn btn-primary">
          </form>
          <button class="btn btn-secondary" id="goToRegister">Nouveau compte</button>
          </div>
      `);

  initFormValidation(); // important do to after all html injection!

  $("#goToRegister").on("click", async function () {
    $("#form").show();
    $("#form").empty();
    $("#viewTitle").text("Inscription");
    $("#form").append(`
        <div class="abcdefg">
          <form class="form" id="registerForm">
          <fieldset>
            <legend>Adresse courriel</legend>
            <input 
                  class="form-control"
                  name="Email"
                  id="Email"
                  placeholder="Courriel"
                  required
                  type="email"
                  CustomErrorMessage="Ce courriel est déjà utilisé"
              />
              <input 
                  class="form-control MatchedInput"
                  name="Email-confirm"
                  id="EmailConfirm"
                  placeholder="Confirmer le courriel"
                  required
                  type="email"
                  matchedInputId="Email"
                  CustomErrorMessage="Les courriels ne correspondent pas"
              />
          </fieldset>
          <fieldset>
            <legend>Mot de passe</legend>
            <input 
                  class="form-control"
                  name="Password"
                  id="Password"
                  placeholder="Mot de passe"
                  required
                  type="password"
                  matchedInputId="PasswordConfirm"
              />
              <input 
                  class="form-control MatchedInput"
                  name="Password-confirm"
                  id="PasswordConfirm"
                  placeholder="Confirmer le mot de passe"
                  required
                  type="password"
                  matchedInputId="Password"
                  CustomErrorMessage="Les mots de passe ne correspondent pas"
              />
          </fieldset>
          <fieldset>
            <legend>Nom</legend>
            <input 
                class="form-control"
                name="Name"
                id="Name"
                placeholder="Nom"
                required
                type="text"
              />
          </fieldset>
          <fieldset>
            <legend>Avatar</legend>
            <label class="form-label">Image </label>
            <div class='imageUploaderContainer'>
                <div class='imageUploader'
                     newImage='${create}'
                     controlId='Avatar'
                     imageSrc='${user.Avatar}' 
                     waitingImage="Loading_icon.gif">
                </div>
            </div>
          </fieldset>
          <input type="submit" value="Enregistrer" id="registerSubmit" class="btn btn-primary">
          </form>
          </div>
      `);

    initImageUploaders();
    initFormValidation();
    addConflictValidation(
      `${API_IP}/accounts/conflict`,
      "Email",
      "registerSubmit"
    );

    $("#registerForm").on("submit", async function (event) {
      event.preventDefault();
      const newUser = getFormData($("#registerForm"));
      $.ajax({
        url: `${API_IP}/accounts/register`,
        method: "POST",
        contentType: "application/json",
        data: JSON.stringify({
          Email: $("#Email").val(),
          Password: $("#Password").val(),
          Name: $("#Name").val(),
          Avatar: newUser.Avatar,
        }),
        success: function (response) {
          showLoginPage(
            "Votre compte a été créé. Veuillez prendre vos courriels pour récupérer votre code de vérification qui vous sera demandé lors de votre prochaine connexion."
          );
        },
        error: function (error) {
          $("#errMsg").text(error.responseJSON.error_description);
        },
      });
    });
  });

  $("#loginForm").on("submit", async function (event) {
    event.preventDefault();
    $.ajax({
      url: `${API_IP}/token`,
      method: "POST",
      contentType: "application/json",
      data: JSON.stringify({
        Email: $("#Email").val(),
        Password: $("#Password").val(),
      }),
      success: function (response) {
        const user = response.User;
        if (user.Authorizations.readAccess != 0) {
          sessionStorage.setItem("bearerToken", response.Access_token);
          sessionStorage.setItem("expiration", response.Expire_Time);
          sessionStorage.setItem("user", JSON.stringify(user));
          showPosts();
        } else {
          $("#errMsg").text("Ce compte est bloqué.");
        }
      },
      error: function (error) {
        $("#errMsg").text(error.responseJSON.error_description);
      },
    });
  });
}
