/**
 * Created by sergey on 12.03.17.
 */

var promise = require('bluebird');

var options = {
    promiseLib: promise
};

var pgp = require('pg-promise')(options);
var connectionString = "postgres://docker:docker@localhost:5432/docker";
var db = pgp(connectionString);

function isEmpty(obj) {
    for (let key in obj) {
        return false;
    }
    return true;
}

function isNumeric(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
}

function compareNumeric(a, b) {
    if (a > b) return 1;
    if (a < b) return -1;
}

function createUser(req, res, next) {
    const nickname = req.params.nickname;
    const fullname = req.body.fullname;
    const about = req.body.about;
    const email = req.body.email;
    db.none('select * from users where upper(nickname) = $1 or upper(email) = $2',
        [nickname.toUpperCase(), email.toUpperCase()])
        .then(function () {
            return db.none('insert into users values (\'' + nickname + '\', \'' + fullname + '\',' +
                ' \'' + about +'\', \'' + email + '\')')
                .then(function () {
                    res.status(201)
                        .json({
                            about: req.body.about,
                            email: req.body.email,
                            fullname: req.body.fullname,
                            nickname: req.params.nickname
                        });
                })
        })
        .catch(function (err) {
            return db.any('select * from users where upper(nickname) = $1 or upper(email) = $2',
                [nickname.toUpperCase(), email.toUpperCase()])
               .then(function (data) {
                   let array = [];
                   for(let i = 0; i < data.length; i++)
                   {
                       array.push(data[i]);
                   }
                   res.status(409).send(array);
                })
        })
        .catch(function (err) {
            return next(err);
        });
}

function getUser(req, res, next) {
    let nickname = req.params.nickname;
    db.one('select * from users where upper(nickname) = $1', nickname.toUpperCase())
        .then(function (data) {
            console.log(data);
            let d = JSON.stringify(data);
            d = JSON.parse(d);
            res.status(200).send(d);
        })
        .catch(function (err) {
            res.status(404).send();
        });
}

function updateUser(req, res, next) {
    let nickname = req.params.nickname;

    let fullname = req.body.fullname;
    let about = req.body.about;
    let email = req.body.email;
    db.one('select * from users where upper(nickname) = $1', nickname.toUpperCase())
        .catch(function (err) {
            res.status(404).send();
        })
        .then(function (data) {
            if(isEmpty(email) && isEmpty(about) && isEmpty(fullname)) {

                let d = JSON.stringify(data);
                d = JSON.parse(d);
                res.status(200).send(d);
            } else if(isEmpty(email)) {
                if (!isEmpty(about)) {
                    if (!isEmpty(fullname)) {
                        return db.none('update users set (about, fullname) = (\'' + about + '\',' +
                            ' \'' + fullname + '\') where nickname = $1', data.nickname);
                    } else {
                        return db.none('update users set (about) = (\'' + about + '\')' +
                            ' where nickname = $1', data.nickname);
                    }
                } else {
                    return db.none('update users set (fullname) = (\'' + fullname + '\')' +
                        ' where nickname = $1', data.nickname);
                }
            } else {
                return db.none('select * from users where upper(email) = $1', email.toUpperCase());
            }
        })
        .then(function () {
            if(isEmpty(email)) {
                return db.one('select * from users where upper(nickname) = $1', nickname.toUpperCase());
            } else {
                if (!isEmpty(about)) {
                    if (!isEmpty(fullname)) {
                        return db.none('update users set (email, about, fullname) = (\'' + email + '\', \'' + about + '\',' +
                            ' \'' + fullname + '\') where  upper(nickname) = $1', nickname.toUpperCase());
                    } else {
                        return db.none('update users set (email, about) = (\'' + email + '\', \'' + about + '\')' +
                            ' where  upper(nickname) = $1', nickname.toUpperCase());
                    }
                } else {
                    if (!isEmpty(fullname)) {
                        return db.none('update users set (email, fullname) = (\'' + email + '\', ' +
                            ' \'' + fullname + '\') where  upper(nickname) = $1', nickname.toUpperCase());
                    } else {
                        return db.none('update users set (email) = (\'' + email + '\')' +
                            ' where  upper(nickname) = $1', nickname.toUpperCase());
                    }
                }
            }
        })
        .then(function (data) {
            if(isEmpty(email)) {
                let d = JSON.stringify(data);
                d = JSON.parse(d);
                res.status(200).send(d);
            } else {
                return db.one('select * from users where upper(nickname) = $1', nickname.toUpperCase());
            }
        })
        .then(function (data) {
            let d = JSON.stringify(data);
            d = JSON.parse(d);
            res.status(200).send(d);
        })
        .catch(function (err) {
            res.status(409).send();
        });
}

function createForum(req, res, next) {
    const slug = req.body.slug;
    const title = req.body.title;
    const username = req.body.user;
    db.none('select * from forums where upper(username) = $1', username.toUpperCase())
        .then(function () {
            return db.one('select * from users where upper(nickname) = $1', username.toUpperCase())
        })
        .then(function (data) {
            return db.none('insert into forums (title, username, slug) ' +
                'values (\'' + title + '\',\'' + data.nickname + '\',\'' + slug + '\')')
        })
        .then(function () {
            return db.one('select * from forums where upper(username) = $1', username.toUpperCase())
        })
        .then(function (data) {
            res.status(201)
                .json({
                    title: data.title,
                    user: data.username,
                    slug: data.slug,
                });
        })
        .catch(function (err) {
            return db.one('select * from forums where upper(username) = $1', username.toUpperCase())
                .then(function (data) {
                    res.status(409)
                        .json({
                            title: data.title,
                            user: data.username,
                            slug: data.slug,
                        });
                })
        })
        .catch(function (err) {
            res.status(404).send();
        });
}

function getForum(req, res, next) {
    const slug = req.params.slug;
    db.one('select forums.title, forums.username, forums.slug, forums.posts, forums.threads from forums' +
        ' where upper(slug) = $1', slug.toUpperCase())
        .then(function (data) {
            let d = JSON.stringify(data);
            d = JSON.parse(d);
            res.status(200).json({
                slug: d.slug,
                title: d.title,
                user: d.username,
                posts: d.posts,
                threads: d.threads
            });
            // let d = JSON.stringify(data);
            // d = JSON.parse(d);
            // res.status(200).send(d);
        })
        .catch(function (err) {
            res.status(404).send();
        });
}

function createThread(req, res, next) {
    let author = req.body.author;
    let created = req.body.created;
    let forum = req.body.forum;
    let message = req.body.message;
    let title = req.body.title;
    let slug = req.params.slug;
    if(!isEmpty(req.body.slug))
    {
        slug = req.body.slug;
    }
    db.none('select * from threads where upper(slug) = $1', slug.toUpperCase())
        .catch(function (err) {
            return db.one('select threads.id, threads.author, threads.created, threads.message, threads.slug, ' +
                'threads.title, forums.slug as forum from threads inner join forums on (forums.id = threads.forum) ' +
                'where upper(threads.slug) = $1', slug.toUpperCase())
                .then(function (data) {
                    d = JSON.stringify(data);
                    d = JSON.parse(d);
                    res.status(409).send(d);
                });
        })
        .then(function () {
            return db.one('select * from forums where upper(slug) = $1', forum.toUpperCase())
        })
        .then(function (data) {
            forum = data.slug;
            if(isEmpty(created)) {
                return db.none('insert into threads (author, forum, message, title, slug) ' +
                    'values (\'' + author + '\',' + data.id + ',\'' + message + '\',' +
                    '\'' + title + '\',\'' + slug + '\')')
            } else {
                return db.none('insert into threads (author, created, forum, message, title, slug) ' +
                    'values (\'' + author + '\',\'' + created + '\',' + data.id + ',\'' + message + '\',' +
                    '\'' + title + '\',\'' + slug + '\')')
            }
        })
        .then(function () {
            return db.one('select forums.threads from forums where upper(slug) = $1', forum.toUpperCase());
        })
        .then(function (data) {
            let thr = data.threads;
            thr++;
            return db.none('update forums set (threads) = (' + thr + ') where upper(slug) = $1', forum.toUpperCase())
        })
        .then(function () {
            return db.one('select * from threads where upper(slug) = $1', slug.toUpperCase())
        })
        .then(function (data) {
            if(isEmpty(created)) {
                if(isEmpty(req.body.slug))
                {
                    res.status(201)
                        .json({
                            author: data.author,
                            forum: forum,
                            id: data.id,
                            message: data.message,
                            title: data.title
                        });
                } else {
                    res.status(201)
                        .json({
                            author: data.author,
                            slug: data.slug,
                            forum: forum,
                            id: data.id,
                            message: data.message,
                            title: data.title
                        });
                }
            } else if (isEmpty(req.body.slug)) {
                res.status(201)
                    .json({
                        author: data.author,
                        created: data.created,
                        forum: forum,
                        id: data.id,
                        message: data.message,
                        title: data.title
                    });
            } else {
                res.status(201)
                    .json({
                        author: data.author,
                        created: data.created,
                        slug: data.slug,
                        forum: forum,
                        id: data.id,
                        message: data.message,
                        title: data.title
                    });
            }
        })
        .catch(function (err) {
            res.status(404).send();
        })
}

function getThreads(req, res, next) {
    const desc = req.query.desc;
    const limit = req.query.limit;
    const since = req.query.since;
    const slug = req.params.slug;
    db.one('select * from forums where upper(slug) = $1', slug.toUpperCase())
        .then(function (data) {
            let str = 'select threads.slug, threads.id, threads.title, threads.message, threads.author, threads.created, forums.slug as forum' +
                ' from threads INNER JOIN forums ON (forums.id = threads.forum) where threads.forum = $1';
            let query = str;
            if(!isEmpty(since)) {
                if(desc === "true") {
                    query = query + " and threads.created <= $2";
                } else {
                    query = query + " and threads.created >= $2";
                }
            }
            query = query +  ' order by threads.created';
            if(!isEmpty(desc)) {
                if(desc === "true") {
                    query = query + " desc";
                }
            }
            if(!isEmpty(limit)) {
                query = query + " limit " + limit;
            }
            if(isEmpty(since)) {
                return db.any(query, data.id)
            } else {
                return db.any(query, [data.id, since])
            }
        })
        .then(function (data) {
            let n = data.length;
            let array = [];
            for(let i = 0; i < n; i++) {
                array.push(data[i]);
            }
            res.status(200).send(array);
        })
        .catch(function (err) {
            res.status(404).send(err);
        });
}

function createOneThread(req, res, next) {
    let slug = req.params.slug_or_id;
    let num_post = req.body.length;
    let dataid = 0;
    let dataforum = '';
    let str_query = '';
    let arr = [];
    let arr2 = [];

    if(isNumeric(slug) === false) {
        str_query = 'upper(threads.slug)';
        slug = slug.toUpperCase();
    } else {
        str_query = 'threads.id';
    }

    db.one('select threads.id, forums.slug as forum from threads ' +
        'inner join forums on (threads.forum = forums.id) where ' + str_query + ' = $1', slug)
        .catch(function (err) {
            res.status(404).send();
        })
        .then(function (data) {
            dataid = data.id;
            dataforum = data.forum;
            for (let i = 0; i < num_post; i++) {
                let p = req.body[i].parent;
                if(p === undefined) {
                    p = 0;
                }
                let obj = {};
                obj.author = req.body[i].author;
                obj.isEdited = req.body[i].isEdited;
                obj.message = req.body[i].message;
                obj.parent = p;
                obj.thread = dataid;
                obj.forum = dataforum;
                arr.push(obj);
            }
            return db.any('select * from posts where posts.thread = $1', data.id);
         })
        .then(function (data) {
            let check = 0;
            for(let j = 0; j < arr.length; j++) {
                if(arr[j].parent === 0) {
                    check++;
                } else {
                    if(!isEmpty(data)) {
                        for (let i = 0; i < data.length; i++) {
                            if (arr[j].parent === data[i].id) {
                                check++;
                            }
                        }
                    }
                }
            }
            if(check === num_post) {
                return db.tx(function (t) {
                    let queries = arr.map(function (l) {
                        return t.one('INSERT INTO posts (author, isEdited, message, parent, thread, forum) ' +
                            'VALUES(${author}, ${isEdited}, ${message}, ${parent}, ${thread}, ${forum}) returning id;', l);
                    });
                    return t.batch(queries);
                });
            } else {
                res.status(409).send();
            }
        })
        .then(function (data) {
            for (let i = 0; i < data.length; i++) {
                arr2.push(data[i].id);
            }
            return db.one('select forums.posts from forums where upper(slug) = $1', dataforum.toUpperCase());
        })
        .then(function (data) {
            let pst = data.posts;
            pst += arr2.length;
            return db.none('update forums set (posts) = (' + pst + ') where upper(slug) = $1', dataforum.toUpperCase())
        })
        .then(function () {
            arr2.sort(compareNumeric);
            return db.any('select posts.author, posts.created, posts.id, posts.isEdited, posts.message, posts.thread,' +
                 'posts.forum, posts.parent from posts where posts.id >= $1 order by posts.id ', arr2[0]);
        })
        .then(function (data) {
            let n = data.length;
            let array = [];
            for(let i = 0; i < n; i++) {
                array.push(data[i]);
            }
            res.status(201).send(array);
        })
        .catch(function (err) {
            res.status(404).send();
        });
}

function createVote(req, res, next) {
    let slug = req.params.slug_or_id;
    let slugid = parseInt(req.params.slug_or_id);

    let nickname = req.body.nickname;
    let voice = req.body.voice;
    let thrvotes = 0;

    if(isNumeric(slug) === false) {
        db.one('select * from threads where upper(threads.slug) = $1', slug.toUpperCase())
            .catch(function (err) {
                res.status(404).send();
            })
            .then(function (data) {
                thrvotes = data.votes;
                return db.one('select * from votes where votes.username = $1 and votes.thread = $2', [nickname, data.id])
            })
            .then(function (data) {
                thrvotes = thrvotes - data.voice + voice;
                return db.one('update votes set (voice) = (' + voice + ') where id = $1 returning thread', data.id)
            })
            .then(function (data) {
                return db.one('update threads set (votes) = (' + thrvotes + ') where id = $1 returning id', data.thread)
            })
            .then(function (data) {
                return db.one('select forums.slug as forum, threads.author, threads.created, threads.id,' +
                    ' threads.message, threads.slug, threads.title, threads.votes from threads inner join forums' +
                    ' on (threads.forum=forums.id) where threads.id = $1', data.id);
            })
            .then(function (data) {
                d = JSON.stringify(data);
                d = JSON.parse(d);
                res.status(200).send(d);
            })
            .catch(function () {
                return db.one('select * from threads where upper(threads.slug) = $1', slug.toUpperCase())
            })
            .then(function (data) {
                thrvotes = data.votes + voice;
                return db.one('insert into votes (username, voice, thread) ' +
                    'values (\'' + nickname + '\',' + voice + ',\'' + data.id + '\') returning thread')
            })
            .then(function (data) {
                return db.one('update threads set (votes) = (' + thrvotes + ') where id = $1 returning id', data.thread)
            })
            .then(function (data) {
                return db.one('select forums.slug as forum, threads.author, threads.created, threads.id,' +
                    ' threads.message, threads.slug, threads.title, threads.votes from threads inner join forums' +
                    ' on (threads.forum=forums.id) where threads.id = $1', data.id);
            })
            .then(function (data) {
                d = JSON.stringify(data);
                d = JSON.parse(d);
                res.status(200).send(d);
            })
            .catch(function (err) {
                res.status(404).send();
            });
    } else {
        db.one('select * from threads where threads.id = $1', slug)
            .catch(function (err) {
                res.status(404).send();
            })
            .then(function (data) {
                thrvotes = data.votes;
                return db.one('select * from votes where votes.username = $1 and votes.thread = $2', [nickname, data.id])
            })
            .then(function (data) {
                thrvotes = thrvotes - data.voice + voice;
                return db.one('update votes set (voice) = (' + voice + ') where id = $1 returning thread', data.id)
            })
            .then(function (data) {
                return db.one('update threads set (votes) = (' + thrvotes + ') where id = $1 returning id', data.thread)
            })
            .then(function (data) {
                return db.one('select forums.slug as forum, threads.author, threads.created, threads.id,' +
                    ' threads.message, threads.slug, threads.title, threads.votes from threads inner join forums' +
                    ' on (threads.forum=forums.id) where threads.id = $1', data.id);
            })
            .then(function (data) {
                d = JSON.stringify(data);
                d = JSON.parse(d);
                res.status(200).send(d);
            })
            .catch(function () {
                return db.one('select * from threads where threads.id = $1', slug)
            })
            .then(function (data) {
                thrvotes = data.votes + voice;
                return db.one('insert into votes (username, voice, thread) ' +
                    'values (\'' + nickname + '\',' + voice + ',\'' + data.id + '\') returning thread')
            })
            .then(function (data) {
                return db.one('update threads set (votes) = (' + thrvotes + ') where id = $1 returning id', data.thread)
            })
            .then(function (data) {
                return db.one('select forums.slug as forum, threads.author, threads.created, threads.id,' +
                    ' threads.message, threads.slug, threads.title, threads.votes from threads inner join forums' +
                    ' on (threads.forum=forums.id) where threads.id = $1', data.id);
            })
            .then(function (data) {
                d = JSON.stringify(data);
                d = JSON.parse(d);
                res.status(200).send(d);
            })
            .catch(function (err) {
                res.status(404).send();
            });
    }
}

function getThread(req, res, next) {
    let slug = req.params.slug_or_id;
    if(isNumeric(slug) === false) {
        db.one('select forums.slug as forum, threads.author, threads.created, threads.title, threads.slug, ' +
            ' threads.message, threads.id, threads.votes' +
            ' from threads inner join forums on (threads.forum=forums.id)' +
            ' where upper(threads.slug) = $1', slug.toUpperCase())
            .then(function (data) {
                d = JSON.stringify(data);
                d = JSON.parse(d);
                res.status(200).send(d);
            })
            .catch(function (err) {
                res.status(404).send();
            });
    } else {
        db.one('select forums.slug as forum, threads.author, threads.created, threads.title, threads.slug, ' +
            ' threads.message, threads.id, threads.votes' +
            ' from threads inner join forums on (threads.forum=forums.id)' +
            ' where threads.id = $1', slug)
            .then(function (data) {
                d = JSON.stringify(data);
                d = JSON.parse(d);
                res.status(200).send(d);
            })
            .catch(function (err) {
                res.status(404).send();
            });
    }
}

function updateThread(req, res, next) {
    let slug = req.params.slug_or_id;

    let str_query = '';
    if(isNumeric(slug) === false) {
        str_query = 'upper(threads.slug)';
        slug = slug.toUpperCase();
    } else {
        str_query = 'threads.id';
    }

    db.one('select * from threads where ' + str_query + ' = $1', slug)
        .then(function (data) {
            if(!isEmpty(req.body.title) && !isEmpty(req.body.message)) {
                return db.none('update threads set (title, message) = (\'' + req.body.title + '\',' +
                    '\'' + req.body.message + '\') where ' + str_query + ' = $1', slug);
            } else if (!isEmpty(req.body.title)) {
                return db.none('update threads set (title) = (\'' + req.body.title + '\') where ' + str_query + ' = $1', slug);
            } else if (!isEmpty(req.body.message)) {
                return db.none('update threads set (message) = (\'' + req.body.message + '\') where ' + str_query + ' = $1', slug);
            } else {
                return db.one('select forums.slug as forum, threads.author, threads.created, threads.title,' +
                    ' threads.slug, threads.message, threads.id from threads inner join forums' +
                    ' on (threads.forum=forums.id) where ' + str_query + ' = $1', slug);
            }
        })
        .then(function (data) {
            return db.one('select forums.slug as forum, threads.author, threads.created, threads.title,' +
                ' threads.slug, threads.message, threads.id from threads inner join forums' +
                ' on (threads.forum=forums.id) where ' + str_query + ' = $1', slug);
        })
        .then(function (data) {
            let d = JSON.stringify(data);
            d = JSON.parse(d);
            res.status(200).send(d);
        })
        .catch(function (err) {
            res.status(404).send();
        });

}

function getPosts(req, res, next) {
    const desc = req.query.desc;
    const limit = req.query.limit;
    const marker = parseInt(req.query.marker);
    const sort = req.query.sort;
    let slug = req.params.slug_or_id;

    let str_query = '';
    if(isNumeric(slug) === false) {
        str_query = 'upper(threads.slug)';
        slug = slug.toUpperCase();
    } else {
        str_query = 'threads.id';
    }
    let query;

    db.one('select * from threads where ' + str_query + ' = $1', slug)
        .then(function (data) {
            if(sort === 'flat') {
                query = 'select posts.author, posts.created, posts.id, posts.isEdited, posts.message, posts.thread,' +
                    'posts.forum, posts.parent from posts where posts.thread = $1 ';
                query = query + 'order by posts.id ';
                if(desc === 'true') {
                    query = query + 'desc ';
                }
                if(!isEmpty(limit)) {
                    query = query + 'limit ' + limit;
                }
                if(marker) {
                    query = query + 'offset ' + marker;
                }
                return db.any(query, data.id);
            } else if(sort === 'tree') {
                query = 'with recursive tree(id, parent, author, message, isEdited, forum, thread, created, path) AS( ' +
                    'select id, parent, author, message, isEdited, forum, thread, created, ARRAY[id] from posts where' +
                    ' thread = $1 and parent=0 union ' +
                    'select posts.id, posts.parent, posts.author, posts.message, posts.isEdited, posts.forum, ' +
                    'posts.thread, posts.created, path||posts.id FROM posts ' +
                    'join tree on posts.parent = tree.id where posts.thread = $1) ' +
                    'select id, parent, author, message, isEdited, forum, thread, created from tree ';
                if(desc === 'true') {
                    query = query + 'order by path desc ';
                } else {
                    query = query + 'order by path, created asc ';
                }
                if(!isEmpty(limit)) {
                    query = query + 'limit ' + limit;
                }
                if(marker) {
                    query = query + 'offset ' + marker;
                }
                return db.any(query, data.id);
            } else if(sort === 'parent_tree')
            {
                query = 'WITH RECURSIVE tree(id, parent, author, message, isEdited, forum, thread, created, path) AS(' +
                '(SELECT id, parent, author, message, isEdited, forum, thread, created, ARRAY[id] FROM posts ' +
                'WHERE thread = $1 AND parent=0';
                if (desc === "true") {
                    query = query + ' order by id desc ';
                } else {
                    query = query + ' order by id asc ';
                }
                if(!isEmpty(limit)) {
                    query = query + 'limit ' + limit;
                }
                if(marker) {
                    query = query + 'offset ' + marker;
                }
                query = query + ') UNION ' +
                'SELECT posts.id, posts.parent, posts.author, posts.message, posts.isEdited, posts.forum, posts.thread, ' +
                'posts.created, path||posts.id FROM posts JOIN tree ON posts.parent = tree.id ' +
                'WHERE posts.thread = $1) SELECT id, parent, author, message, isEdited, forum, thread, created FROM tree';
                if(desc === "true") {
                    query = query + ' order by path desc';
                } else {
                    query = query + ' order by path asc';
                }
                return db.any(query, data.id);
            } else {
                query = 'select posts.author, posts.created, posts.id, posts.isEdited, posts.message, posts.thread, ' +
                    'posts.forum, posts.parent from posts where posts.thread = $1 ';
                query = query + 'order by posts.id ';
                if(desc === 'true') {
                    query = query + 'desc ';
                }
                if(!isEmpty(limit)) {
                    query = query + 'limit ' + limit;
                }
                if(marker) {
                    query = query + ' offset ' + marker;
                }
                return db.any(query, data.id);
            }
        })
        .then(function (data) {
            let m = 3;
            if(marker) {
                m = marker + 3;
            }
            if(isEmpty(data) === true) {
                m = m - 3;
            }
            m = String(m);
            res.status(200)
                .json({
                    marker: m,
                    posts: data
                });
        })
        .catch(function (err) {
            res.status(404).send();
        });

    // db.one('select * from forums where upper(slug) = $1', slug.toUpperCase())
    //     .then(function (data) {
    //         let str = 'select threads.slug, threads.id, threads.title, threads.message, threads.author, threads.created, forums.slug as forum' +
    //             ' from threads INNER JOIN forums ON (forums.id = threads.forum) where threads.forum = $1';
    //         let query = str;
    //         if(!isEmpty(since)) {
    //             if(desc === "true") {
    //                 query = query + " and threads.created <= $2";
    //             } else {
    //                 query = query + " and threads.created >= $2";
    //             }
    //         }
    //         query = query +  ' order by threads.created';
    //         if(!isEmpty(desc)) {
    //             if(desc === "true") {
    //                 query = query + " desc";
    //             }
    //         }
    //         if(!isEmpty(limit)) {
    //             query = query + " limit " + limit;
    //         }
    //         if(isEmpty(since)) {
    //             return db.any(query, data.id)
    //         } else {
    //             return db.any(query, [data.id, since])
    //         }
    //     })
    //     .then(function (data) {
    //         let n = data.length;
    //         let array = [];
    //         for(let i = 0; i < n; i++) {
    //             array.push(data[i]);
    //         }
    //         res.status(200).send(array);
    //     })
    //     .catch(function (err) {
    //         res.status(404).send(err);
    //     });
}

function getUsers(req, res, next) {
    const desc = req.query.desc;
    const limit = req.query.limit;
    const since = req.query.since;
    const slug = req.params.slug;
    db.one('select * from forums where upper(slug) = $1', slug.toUpperCase())
        .then(function (data) {
            let query = 'select * from users where (users.nickname in (' +
                ' select distinct threads.author from threads where threads.forum = $1 ) or users.nickname in (' +
                ' select distinct posts.author from posts where posts.forum = $2 )) ';
            if(!isEmpty(since)) {
                if(desc === "true") {
                    query = query + ' and lower(users.nickname) collate "ucs_basic" < ' +
                        'lower($3) collate "ucs_basic"';
                } else {
                    query = query + ' and lower(users.nickname) collate "ucs_basic" > ' +
                        'lower($3) collate "ucs_basic"';
                }
            }
            query = query +  ' order by lower(users.nickname) collate "ucs_basic"';
            if(desc === "true") {
                query = query + " desc";
            } else {
                query = query + " asc";
            }
            if(!isEmpty(limit)) {
                query = query + " limit " + limit;
            }
            if(!isEmpty(since)) {
                return db.any(query, [data.id, data.slug, since]);
            } else {
                return db.any(query, [data.id, data.slug]);
            }
        })
        .then(function (data) {
            let n = data.length;
            let array = [];
            for(let i = 0; i < n; i++) {
                array.push(data[i]);
            }
            res.status(200).send(array);
        })
        .catch(function (err) {
            res.status(404).send(err);
        });
}

function getPost(req, res, next) {
    let id = req.params.id;
    let related = req.query.related;
    let user = '';
    let thread = '';
    let forum = '';
    let u, t, d, f, author, threadid, forumslug;
    if(!isEmpty(related)) {
        if (related.indexOf('user') !== -1) {
            user = 'user';
        }
        if (related.indexOf('thread') !== -1) {
            thread = 'thread';
        }
        if (related.indexOf('forum') !== -1) {
            forum = 'forum';
        }
    }

    db.one('select * from posts where posts.id = $1', id)
        .then(function (data) {
            author = data.author;
            threadid = data.thread;
            forumslug = data.forum;
            d = JSON.stringify(data);
            d = JSON.parse(d);
            if(user === 'user') {
                return db.one('select * from users where users.nickname = $1', author);
            } else if (thread === 'thread') {
                return db.one('select forums.slug as forum, threads.author, threads.id, threads.slug, threads.title,' +
                    ' threads.message, threads.created from threads inner join forums on (threads.forum=forums.id)' +
                    ' where threads.id = $1', threadid);
            } else if(forum === 'forum') {
                return db.one('select forums.slug, forums.username as \"user\", forums.title, forums.posts,' +
                    ' forums.threads from forums where forums.slug = $1', forumslug);
            } else {
                res.status(200)
                    .json({
                        post: d
                    });
            }
        })
        .then(function (data) {
            if(user === 'user') {
                u = JSON.stringify(data);
                u = JSON.parse(u);
                if(thread === 'thread') {
                    return db.one('select forums.slug as forum, threads.author, threads.id, threads.slug, threads.title,' +
                        ' threads.message, threads.created from threads inner join forums on (threads.forum=forums.id)' +
                        ' where threads.id = $1', threadid);
                } else if (forum === 'forum') {
                    return db.one('select forums.slug, forums.username as \"user\", forums.title, forums.posts,' +
                        ' forums.threads from forums where forums.slug = $1', forumslug);
                } else {
                    res.status(200)
                        .json({
                            author: u,
                            post: d
                        });
                }
            } else if(thread === 'thread'){
                t = JSON.stringify(data);
                t = JSON.parse(t);
                if(forum === 'forum') {
                    return db.one('select forums.slug, forums.username as \"user\", forums.title, forums.posts,' +
                        ' forums.threads from forums where forums.slug = $1', forumslug);
                } else {
                    res.status(200)
                        .json({
                            thread: t,
                            post: d
                        });
                }
            } else {
                f = JSON.stringify(data);
                f = JSON.parse(f);
                res.status(200)
                    .json({
                        forum: f,
                        post: d
                    });
            }
        })
        .then(function (data) {
            if(user === 'user') {
                if(thread === 'thread') {
                    t = JSON.stringify(data);
                    t = JSON.parse(t);
                    if(forum === 'forum') {
                        return db.one('select forums.slug, forums.username as \"user\", forums.title, forums.posts,' +
                            ' forums.threads from forums where forums.slug = $1', forumslug);
                    } else {
                        res.status(200)
                            .json({
                                author: u,
                                thread: t,
                                post: d
                            });
                    }
                } else {
                    f = JSON.stringify(data);
                    f = JSON.parse(f);
                    res.status(200)
                        .json({
                            author: u,
                            forum: f,
                            post: d
                        });
                }
            }
            if(thread === 'thread') {
                f = JSON.stringify(data);
                f = JSON.parse(f);
                res.status(200)
                    .json({
                        thread: t,
                        forum: f,
                        post: d
                    });
            } else if (forum === 'forum') {
                f = JSON.stringify(data);
                f = JSON.parse(f);
                res.status(200)
                    .json({
                        author: u,
                        forum: f,
                        post: d
                    });
            }
        })
        .then(function (data) {
            f = JSON.stringify(data);
            f = JSON.parse(f);
            res.status(200)
                .json({
                    author: u,
                    thread: t,
                    forum: f,
                    post: d
                });
        })
        .catch(function (err) {
           res.status(404).send();
        });
}

function updatePost(req, res, next) {
    let id = req.params.id;
    let message = req.body.message;

    db.one('select * from posts where posts.id = $1', id)
        .then(function (data) {
            if(!isEmpty(message)) {
                if(message !== data.message) {
                    return db.none('update posts set (message, isEdited) = (\'' + req.body.message + '\', true)' +
                        ' where posts.id = $1', id);
                } else {
                    let d = JSON.stringify(data);
                    d = JSON.parse(d);
                    res.status(200).send(d);
                }
            } else {
                let d = JSON.stringify(data);
                d = JSON.parse(d);
                res.status(200).send(d);
            }
        })
        .then(function () {
            return db.one('select * from posts where posts.id = $1', id);
        })
        .then(function (data) {
            let d = JSON.stringify(data);
            d = JSON.parse(d);
            res.status(200).send(d);
        })
        .catch(function (err) {
            res.status(404).send();
        });
}

function getStatus(req, res, next) {

    let user = 0;
    let thread = 0;
    let post = 0;
    let forum;

    db.one('select count(*) from users')
        .then(function (data) {
            let d = JSON.stringify(data);
            d = JSON.parse(d);
            user = d.count;
            return db.one('select count(*) from threads');
        })
        .then(function (data) {
            let d = JSON.stringify(data);
            d = JSON.parse(d);
            thread = d.count;
            return db.one('select count(*) from posts');
        })
        .then(function (data) {
            let d = JSON.stringify(data);
            d = JSON.parse(d);
            post = d.count;
            return db.one('select count(*) from forums');
        })
        .then(function (data) {
            let d = JSON.stringify(data);
            d = JSON.parse(d);
            forum = d.count;
            let obj = {};
            obj.user = parseInt(user);
            obj.thread = parseInt(thread);
            obj.post = parseInt(post);
            obj.forum = parseInt(forum);
            res.status(200).send(obj);
        })
        .catch(function (err) {
            res.status(404).send();
        });
}

function serviceClear(req, res, next) {
    db.none('truncate users cascade')
        .then(function () {
            res.status(200).send();
        })
        .catch(function (err) {
            return next(err);
        });
}

module.exports = {
    createUser: createUser,
    getUser: getUser,
    updateUser: updateUser,
    createForum: createForum,
    getForum: getForum,
    createThread: createThread,
    getThreads: getThreads,
    createOneThread: createOneThread,
    createVote: createVote,
    getThread: getThread,
    updateThread: updateThread,
    getPosts: getPosts,
    getUsers: getUsers,
    getPost: getPost,
    updatePost: updatePost,
    getStatus: getStatus,
    serviceClear: serviceClear
};

