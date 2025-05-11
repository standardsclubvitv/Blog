// public/js/app.js
import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-app.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  updateDoc,
  doc,
  arrayUnion
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js";

// Load Firebase config from backend
const config = await fetch("/firebase-config").then(res => res.json());

// Initialize Firebase
const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM elements
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const createPost = document.getElementById("create-post");
const blogForm = document.getElementById("blog-form");
const blogsContainer = document.getElementById("blogs-container");

let currentUser = null;

// Login
loginBtn.addEventListener("click", async () => {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    const email = result.user.email;
    if (!email.endsWith("@vit.ac.in") && !email.endsWith("@vitstudent.ac.in")) {
      alert("Only VIT emails are allowed");
      await signOut(auth);
      return;
    }

    currentUser = result.user;
    loginBtn.style.display = "none";
    logoutBtn.style.display = "block";
    createPost.style.display = "block";
    blogForm.style.display = "block";
  } catch (error) {
    console.error("Login Error:", error.message);
  }
});

// Logout
logoutBtn.addEventListener("click", () => {
  signOut(auth).then(() => {
    currentUser = null;
    loginBtn.style.display = "block";
    logoutBtn.style.display = "none";
    createPost.style.display = "none";
    blogForm.style.display = "none";
  });
});

// Post blog
blogForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = document.getElementById("title").value;
  const track = document.getElementById("track").value;
  const description = document.getElementById("description").value;
  const imageFile = document.getElementById("image").files[0];
  const source = document.getElementById("source").value;

  const base64Image = imageFile ? await convertImageToBase64(imageFile) : "";

  await addDoc(collection(db, "blogs"), {
    title,
    track,
    description,
    image: base64Image,
    source,
    userId: currentUser.uid,
    userName: currentUser.displayName,
    createdAt: new Date(),
    likes: [],
    comments: [],
  });

  blogForm.reset();
  loadBlogs();
});

// Convert image to base64
function convertImageToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Load blogs with filter
async function loadBlogs() {
  const blogQuery = query(collection(db, "blogs"));
  const querySnapshot = await getDocs(blogQuery);
  blogsContainer.innerHTML = "";

  const selectedTrack = document.getElementById("filter-track").value;
  const selectedDateInput = document.getElementById("filter-date").value;
  const selectedDate = selectedDateInput ? new Date(selectedDateInput) : null;

  querySnapshot.forEach((docSnap) => {
    const blog = docSnap.data();
    const blogId = docSnap.id;

    if (selectedTrack && blog.track !== selectedTrack) return;
    if (selectedDate && new Date(blog.createdAt.toDate ? blog.createdAt.toDate() : blog.createdAt) < selectedDate) return;

    const blogCard = document.createElement("div");
    blogCard.className = "blog-card";

    const fullDescription = blog.description || "";
    const shortDescription = fullDescription.slice(0, 120);
    const isLong = fullDescription.length > 120;

    blogCard.innerHTML = `
      <img src="${blog.image || ""}" class="blog-image" />
      <div class="blog-content">
        <h2 class="blog-title">${blog.title || "Untitled"}</h2>
        <p class="blog-meta">Posted by <strong>${blog.userName || "Unknown"}</strong></p>
        <p class="blog-track"><strong>Track:</strong> ${blog.track || "N/A"}</p>
        <p class="blog-description" id="desc-${blogId}">${shortDescription}${isLong ? "..." : ""}</p>
        ${isLong ? `<button class="read-more-btn" data-id="${blogId}">Read More</button>` : ""}
        <div class="blog-actions">
          <button class="like-btn" data-id="${blogId}">❤️ ${blog.likes?.length || 0}</button>
          <button class="comment-btn" data-id="${blogId}">💬 ${blog.comments?.length || 0}</button>
          <button class="share-btn" data-id="${blogId}">🔗 Share</button>
        </div>
        ${blog.source ? `<a href="${blog.source}" target="_blank" class="blog-link">Source</a>` : ""}
        <div class="comments-section" id="comments-${blogId}">
          ${blog.comments?.map(c => `<div class="comment"><strong>${c.user}</strong>: ${c.text}</div>`).join("") || ""}
        </div>
        <div class="add-comment" style="margin-top:10px;">
          <input type="text" placeholder="Add a comment..." class="comment-input" id="input-${blogId}" />
          <button class="submit-comment-btn" data-id="${blogId}">Post</button>
        </div>
      </div>
    `;

    blogsContainer.appendChild(blogCard);

    blogCard.querySelector(".read-more-btn")?.addEventListener("click", () => {
      blogCard.querySelector(`#desc-${blogId}`).textContent = fullDescription;
    });

    blogCard.querySelector(".like-btn").addEventListener("click", async () => {
      if (!currentUser) return alert("Login to like posts");
      await updateDoc(doc(db, "blogs", blogId), {
        likes: arrayUnion(currentUser.uid),
      });
      loadBlogs();
    });

    blogCard.querySelector(".submit-comment-btn").addEventListener("click", async () => {
      if (!currentUser) return alert("Login to comment");
      const input = document.getElementById(`input-${blogId}`);
      const commentText = input.value.trim();
      if (!commentText) return;
      await updateDoc(doc(db, "blogs", blogId), {
        comments: arrayUnion({
          user: currentUser.displayName,
          text: commentText,
          timestamp: new Date(),
        }),
      });
      loadBlogs();
    });

    blogCard.querySelector(".share-btn").addEventListener("click", () => {
      navigator.clipboard.writeText(window.location.href + `#${blogId}`);
      alert("Link copied!");
    });
  });
}

// Filter buttons
document.getElementById("apply-filter").addEventListener("click", loadBlogs);
document.getElementById("reset-filter").addEventListener("click", () => {
  document.getElementById("filter-track").value = "";
  document.getElementById("filter-date").value = "";
  loadBlogs();
});

// Initial load
loadBlogs();
