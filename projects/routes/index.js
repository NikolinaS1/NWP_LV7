//uvodimo potrebne module

const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const ProjectModel = require("../model/project");
const UserModel = require("../model/user");
const app = require("../app");
var db = require("../model/db");
const bcrypt = require("bcrypt");

//ukoliko korisnik nije prijavljen, preusmjeriti će se na login page
//ukoliko je, dohvaća se sadržaj unutar index.jade
router.get("/", async (req, res, next) => {
  if (!req.session.isLoggedIn) {
    return res.redirect("/login");
  }
  res.render("index");
});

//dohvaća se ID trenutno prijavljenog korisnika, a zatim se koristi taj ID za pronalazak projekata koje je taj korisnik kreirao pomoću await ProjectModel.find
//populate se koristi za dohvaćanje imena korisnika iz podataka o timu
//dobiveni projekti šalju se klijentu renderiranjem
router.get("/my-projects", async (req, res) => {
  if (!req.session.isLoggedIn) {
    return res.redirect("/login");
  } else {
    try {
      const userId = req.session.userId;
      const projects = await ProjectModel.find({ manager: userId }).populate(
        "team.userId",
        "name"
      );
      res.render("my-projects", { projects: projects });
    } catch (err) {
      console.error("Error fetching projects:", err);
      res.status(500).send("Error fetching projects");
    }
  }
});

//dohvaća se ID trenutno prijavljenog korisnika, a zatim se koristi taj ID za pronalazak projekata na kojima je korisnik dodan kao član tima
//populate dohvaća imena korisnika iz podataka o timu projekta
router.get("/part-of-projects", async (req, res) => {
  if (!req.session.isLoggedIn) {
    return res.redirect("/login");
  }

  try {
    const userId = req.session.userId;
    const projects = await ProjectModel.find({
      "team.userId": userId,
    }).populate("team.userId", "name");

    res.render("part-of-projects", { projects: projects });
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).send("Internal Server Error");
  }
});

//renderira se predložak register.jade
router.get("/register", (req, res) => {
  if (req.session.isLoggedIn) {
    return res.redirect("/");
  }
  res.render("register");
});

//destruktira se objekt req.body kako bi se dohvatili podaci koje je korisnik unio u obrazac
//provjerava se postoji li već korisnik s tom email adresom
//hashira se lozinka pomoću bcrypt funkcije
//stvara se nova instanca UserModel i sprema u bazu sa save()
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await UserModel.findOne({ email });

    if (existingUser) {
      return res.status(409).send("User with this email already exists.");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new UserModel({
      name,
      email,
      password: hashedPassword,
    });

    await user.save();
    console.log("User registered successfully:", user);
    res.redirect("/login");
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).send("Internal Server Error");
  }
});

//renderira se predložak login.jade
router.get("/login", (req, res) => {
  if (req.session.isLoggedIn) {
    return res.redirect("/");
  }
  res.render("login");
});

//destruktira se objekt req.body kako bi se dohvatili podaci koje je korisnik unio u obrazac
//provjerava se postoji li korisnik s tom email adresom
//ako korisnik postoji, provjerava se podudara li se unesena lozinka s pohranjenom lozinkom
//ako se korisnik uspješno prijavi, postavlja se req.session.isLoggedIn na true i req.session.userId na ID korisnika
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await UserModel.findOne({ email });

    if (!user) {
      return res.status(404).send("User not found");
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).send("Wrong email or password");
    }

    req.session.isLoggedIn = true;
    req.session.userId = user._id;

    console.log("User logged in successfully:", user);
    res.redirect("/");
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).send("Internal Server Error");
  }
});

//odjava korisnika iz aplikacije
//metoda req.session.destroy() se koristi za uništavanje sesije korisnika
router.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
      res.status(500).send("Internal Server Error");
    } else {
      res.redirect("/login");
    }
  });
});

//definiranje rute za dodavanje novog projekta
//koristi se HTTP GET metoda za prikaz obrasca za unos podataka o novom projektu, te HTTP POST metoda za obradu podataka o novom projektu poslanom s obrasca
// izvlače se podaci o projektu kao što su ime, opis, cijena itd.
//stvara se nova instanca ProjectModel s tim podacima, a novi projekt se sprema u bazu podataka pomoću metode save()
router.get("/add-project", (req, res) => {
  if (!req.session.isLoggedIn) {
    return res.redirect("/login");
  }
  res.render("add-project");
});

router.post("/add-project", async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      completed_jobs,
      start_date,
      end_date,
      isArchived,
    } = req.body;

    const managerId = req.session.userId;

    const project = new ProjectModel({
      name,
      description,
      price,
      completed_jobs,
      start_date,
      end_date,
      isArchived,
      manager: managerId,
    });

    await project.save();

    console.log("Document saved to database...");
    res.redirect("/my-projects");
  } catch (error) {
    console.error("Error saving document...", error);
    res.status(500).send("Internal Server Error");
  }
});

//definiranje rute za uređivanje postojećeg projekta
//koristi se HTTP GET metoda za prikaz obrasca za uređivanje podataka o projektu, te HTTP POST metoda za obradu podataka o uređivanju projekta
router.get("/edit-project/:projectId", async (req, res) => {
  if (!req.session.isLoggedIn) {
    return res.redirect("/login");
  } else {
    try {
      const projectId = req.params.projectId;
      const project = await ProjectModel.findById(projectId);
      var start_date = project.start_date.toISOString();
      start_date = start_date.substring(0, start_date.indexOf("T"));
      var end_date = project.end_date.toISOString();
      end_date = end_date.substring(0, end_date.indexOf("T"));

      if (!project) {
        return res.status(404).send("Project not found");
      }
      res.render("edit-project", {
        start_date: start_date,
        end_date: end_date,
        project: project,
      });
    } catch (error) {
      console.error("Error fetching project for edit:", error);
      res.status(500).send("Internal Server Error");
    }
  }
});

router.post("/edit-project/:projectId", async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const {
      name,
      description,
      price,
      completed_jobs,
      start_date,
      end_date,
      isArchived,
    } = req.body;

    await ProjectModel.findByIdAndUpdate(projectId, {
      name,
      description,
      price,
      completed_jobs,
      start_date,
      end_date,
      isArchived,
    });

    res.redirect("/my-projects");
  } catch (error) {
    console.error("Error updating project:", error);
    res.status(500).send("Internal Server Error");
  }
});

//HTTP GET i HTTP POST metode za uređivanje projekta ako je korisnik dodan kao član projekta
//dozvoljeno je mijenjanje samo elementa completed_jobs, ostalo je postavljeno na readonly u .jade file-u
router.get("/edit-project-user/:projectId", async (req, res) => {
  if (!req.session.isLoggedIn) {
    return res.redirect("/login");
  }

  try {
    const projectId = req.params.projectId;
    const project = await ProjectModel.findById(projectId);
    var start_date = project.start_date.toISOString();
    start_date = start_date.substring(0, start_date.indexOf("T"));
    var end_date = project.end_date.toISOString();
    end_date = end_date.substring(0, end_date.indexOf("T"));

    if (!project) {
      return res.status(404).send("Project not found");
    }
    res.render("edit-project-user", {
      start_date: start_date,
      end_date: end_date,
      project: project,
    });
  } catch (error) {
    console.error("Error fetching project:", error);
    res.status(500).send("Internal Server Error");
  }
});

router.post("/edit-project-user/:projectId", async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const { completed_jobs } = req.body;

    await ProjectModel.findByIdAndUpdate(projectId, {
      completed_jobs,
    });

    res.redirect("/part-of-projects");
  } catch (error) {
    console.error("Error updating project:", error);
    res.status(500).send("Internal Server Error");
  }
});

//pronalaženje projekata koji su ili kreirani od strane trenutno prijavljenog korisnika ili na kojima je on dodan kao član tima, i koji su označeni kao arhivirani
//nakon što se arhivirani projekti uspješno dohvate, renderira se stranica "archive", a arhivirani projekti se prosljeđuju kao podaci za prikaz
router.get("/archive", async (req, res) => {
  if (!req.session.isLoggedIn) {
    return res.redirect("/login");
  }

  try {
    const userId = req.session.userId;
    const archivedProjects = await ProjectModel.find({
      $or: [
        { manager: userId, isArchived: "Yes" },
        { "team.userId": userId, isArchived: "Yes" },
      ],
    }).populate("team.userId", "name");

    res.render("archive", { projects: archivedProjects });
  } catch (error) {
    console.error("Error fetching archived projects:", error);
    res.status(500).send("Internal Server Error");
  }
});

//koristi se HTTP POST metoda za brisanje projekta
//iz parametara rute dohvaća se ID projekta koji se želi izbrisati
//koristi se findByIdAndDelete() metoda za brisanje projekta s tim ID-om iz baze podataka
router.post("/delete-project/:projectId", async (req, res) => {
  try {
    const projectId = req.params.projectId;

    await ProjectModel.findByIdAndDelete(projectId);

    res.redirect("/my-projects");
  } catch (error) {
    console.error("Error deleting project:", error);
    res.status(500).send("Internal Server Error");
  }
});

//pomoću req.params.projectId dobiva se ID projekta za koji se dodaju novi članovi tima
//koristi se ProjectModel.findById() za pronalaženje projekta s dobivenim ID-om
//ako je projekt pronađen, koristi se UserModel.find() za dohvaćanje svih korisnika iz baze podataka
//dobiveni korisnici se pohranjuju u varijablu users
router.get("/add-team-member/:projectId", async (req, res) => {
  if (!req.session.isLoggedIn) {
    return res.redirect("/login");
  }

  try {
    const projectId = req.params.projectId;
    const project = await ProjectModel.findById(projectId);

    if (!project) {
      return res.status(404).send("Project not found");
    }

    const users = await UserModel.find();

    res.render("add-team-member", { users: users, projectId: projectId });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).send("Internal Server Error");
  }
});

//podaci o novim članovima tima dolaze iz req.body
//koristi se Object.keys(req.body) kako bi se dobili ključevi poslanih podataka
//metodom filter() filtriraju se ključevi koji počinju s "teamMember_"
//metodom map() se dobivaju vrijednosti iz filtriranih ključeva
//dobivamo ID-ove novih članova tima, koji su u obliku niza i pohranjeni u varijablu teamMember
//za svakog novog člana tima iz niza teamMembers dohvaćaju se informacije o korisniku
//ako je korisnik pronađen, dodaje se u listu članova tima projekta
//nakon što su svi novi članovi tima dodani u projekt, koristi se project.save()
router.post("/add-team-member/:projectId", async (req, res) => {
  if (!req.session.isLoggedIn) {
    return res.redirect("/login");
  }

  try {
    const projectId = req.params.projectId;
    const project = await ProjectModel.findById(projectId);

    if (!project) {
      return res.status(404).send("Project not found");
    }

    const teamMembers = Object.keys(req.body)
      .filter((key) => key.startsWith("teamMember_"))
      .map((key) => req.body[key]);

    for (const teamMember of teamMembers) {
      const teamMemberInfo = await UserModel.findById(teamMember);
      if (!teamMemberInfo) {
        return res.status(404).send("User not found");
      }
      project.team.push({
        userId: teamMemberInfo._id,
        userName: teamMemberInfo.name,
      });
    }

    await project.save();

    res.redirect("/my-projects");
  } catch (error) {
    console.error("Error adding team members:", error);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;
