# Job descriptions service

This service hosts the job descriptions for the DDaT professions in the Department for Education

## Making changes

You can make changes in GitHub in a pull request, or, run locally and push changes up to the repository.

### Clone the repo

Clone to your device

### Install

Once you've cloned the repo, run the install command

```
npm install
```

### Add a .env file

Create a .env file on the root of the project and add the following keys:

feedbackTemplateID=x
notifyKey=x
BASE_URL=http://localhost:3088

If you need to test the feedback in the service, contact [DfE DesignOps](https://design.education.gov.uk/design-ops) team for the environment variables.

## Add a new profession and job descriptions

This service is largely config driven by json and markdown files.

Provided you follow these instructions, you don't need to do anything else.

### Add a new profession

Within the `app/data` directory, open the `nav.json` file and add a structure for the profession, make sure you use the same family as others so it appears in the same group on the homepage. For example:

```
{
    "name": "Content design",
    "slug": "content-design",
    "family": "User-centered design", 
    "description": "Content designers are responsible for creating, updating and reviewing content across digital services.",
    "roles": [
        {
            "role": "Content designer",
            "slug": "content-designer",
            "grade": "SEO"
        },
        {
            "role": "Senior content designer",
            "slug": "senior-content-designer",
            "grade": "G7"
        },
        {
            "role": "Lead content designer",
            "slug": "lead-content-designer",
            "grade": "G6"
        }
    ]
}
```

### Profession overview

This is displated on the overview page for each profession group (the group is the parent of the roles)

When creating markdown files, you'll use the slugs to name files.

Go to the `app/views/profession_overviews` folder and add a markdown file named the same as the slug of the new profession. For example:

```
content-design.md
```

### Job descriptions

For each of the roles in the profession structure, create a job description markdown file in the `app/views/jd` folder, making sure it matches the slug you use in the roles. For example:

```
lead-content-designer.md
```

or 

```
senior-content-designer.md
```

## App variables and deployment

If you make any changes which need a new environment variable, you will need to add this to the Heroku app. 

If you need access to the Heroku pipeline or app management, speak to [DfE DesignOps](https://design.education.gov.uk/design-ops) to request access.


### Deployment

When a change is merged into the main branch, the Heroku pipeline automatically deploys the change to:

[https://ddt-job-descriptions-5ca184d3d4ce.herokuapp.com](https://ddt-job-descriptions-5ca184d3d4ce.herokuapp.com)


